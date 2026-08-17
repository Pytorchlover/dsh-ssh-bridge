/**
 * Browser-side API client for the /api/remote-ssh route family. The only
 * data access path the panel components use — plain fetch/WebSocket, same
 * origin.
 */

import {
  SSH_API,
  type ConnectStreamLine,
  type ExecResult,
  type HostPayload,
  type HostStatus,
  type ImportResult,
  type RecentWorkspace,
  type RemoteDirEntry,
  type RemoteFileContent,
  type SshConfigAlias,
  type SshHostSummary,
  type TerminalClientFrame,
  type TerminalServerFrame,
  type TransferProgress,
  type TransferStreamLine,
} from '../protocol.ts'

/** Minimal File System Access API surface (not in all lib.dom versions). */
interface WindowWithFileSystemAccess {
  showSaveFilePicker?: (options: { suggestedName?: string }) => Promise<{
    createWritable: () => Promise<{ write: (data: Uint8Array) => Promise<void>; close: () => Promise<void> }>
  }>
}

/** Error carrying the route's JSON error message. */
export class SshApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SshApiError'
  }
}

/** Parse a JSON response or throw an SshApiError. */
async function readJson<T>(response: Response): Promise<T> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new SshApiError(`HTTP ${response.status}: invalid JSON response`)
  }
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : `HTTP ${response.status}`
    throw new SshApiError(message)
  }
  return body as T
}

/** Query-string helper. */
function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text === '' ? '' : '?' + text
}

/** POST JSON, return parsed JSON. */
async function post<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  return await readJson<T>(response)
}

/** One open terminal connection (WebSocket JSON frames). */
export interface TerminalConnection {
  /** Fired on the ready frame (shell is up). */
  onReady: (() => void) | undefined
  /** Fired on every output frame. */
  onOutput: ((data: string) => void) | undefined
  /** Fired on the exit frame (or transport error). */
  onExit: ((code: number | null, error?: string) => void) | undefined
  /** Send raw input to the remote shell. */
  send(data: string): void
  /** Resize the remote PTY. */
  resize(cols: number, rows: number): void
  /** Close the socket and the remote session. */
  close(): void
}

/** Callbacks of the streamed connect flow. */
export interface ConnectCallbacks {
  /** One live connection-log line. */
  onLog(line: string): void
}

/** Terminal outcome of the connect stream. */
export type ConnectOutcome =
  | { ok: true; latencyMs: number; home: string; workspace?: string }
  | { ok: false; error: string }

/** The browser half's only data entry point. */
export class SshApi {
  // -------------------------------------------------------------- hosts
  async listHosts(queryText?: string): Promise<SshHostSummary[]> {
    const response = await fetch(SSH_API.hosts + query({ query: queryText }))
    const body = await readJson<{ hosts: SshHostSummary[] }>(response)
    return body.hosts
  }

  async createHost(payload: HostPayload): Promise<SshHostSummary> {
    const body = await post<{ host: SshHostSummary }>(SSH_API.hosts, payload)
    return body.host
  }

  async updateHost(alias: string, patch: Partial<HostPayload>): Promise<SshHostSummary> {
    const response = await fetch(SSH_API.hosts + query({ alias }), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const body = await readJson<{ host: SshHostSummary }>(response)
    return body.host
  }

  async deleteHost(alias: string): Promise<void> {
    const response = await fetch(SSH_API.hosts + query({ alias }), { method: 'DELETE' })
    await readJson<{ ok: boolean }>(response)
  }

  /** ~/.ssh/config aliases for the form's auto-fill picker (pure read). */
  async sshAliases(): Promise<SshConfigAlias[]> {
    const response = await fetch(SSH_API.sshAliases)
    const body = await readJson<{ aliases: SshConfigAlias[] }>(response)
    return body.aliases
  }

  async importSshConfig(): Promise<ImportResult> {
    const body = await post<{ result: ImportResult }>(SSH_API.importSshConfig)
    return body.result
  }

  // ------------------------------------------------------------ recents
  async listRecents(): Promise<RecentWorkspace[]> {
    const response = await fetch(SSH_API.recents)
    const body = await readJson<{ recents: RecentWorkspace[] }>(response)
    return body.recents
  }

  async addRecent(alias: string, dir: string): Promise<void> {
    await post<{ ok: boolean }>(SSH_API.recents, { alias, dir })
  }

  // ------------------------------------------------------------- status
  async status(): Promise<HostStatus[]> {
    const response = await fetch(SSH_API.status)
    const body = await readJson<{ status: HostStatus[] }>(response)
    return body.status
  }

  // ------------------------------------------------------- remote session
  /** All live remote-session bindings. */
  async sessionList(): Promise<Array<{ sessionId: string; alias: string; dir: string }>> {
    const body = await post<{ bindings: Array<{ sessionId: string; alias: string; dir: string }> }>(SSH_API.session, { action: 'list' })
    return body.bindings
  }

  /** Bind one session to a remote directory (remote-session mode on). */
  async bindSession(sessionId: string, alias: string, dir: string): Promise<void> {
    await post(SSH_API.session, { action: 'bind', sessionId, alias, dir })
  }

  /** Remove one session's remote binding (back to local execution). */
  async unbindSession(sessionId: string): Promise<void> {
    await post(SSH_API.session, { action: 'unbind', sessionId })
  }

  // ---------------------------------------------------- remote workspaces
  /** Materialize a remote workspace: marker dir + display title. */
  async createRemoteWorkspace(alias: string, dir: string): Promise<{ path: string; title: string }> {
    return await post<{ path: string; title: string }>(SSH_API.workspace, { alias, dir })
  }

  /**
   * Raw call into the harness's own /api RPC surface (workspace.create /
   * workspace.rename / session.create …). Body: {type, rpcId, method,
   * payload}; the result envelope is unwrapped, !ok throws.
   */
  async rpc<T>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
    const response = await fetch(`/api/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'client-request', rpcId: `dsh-remote-ssh-${Math.random().toString(36).slice(2)}`, method: endpoint, payload }),
    })
    const body = await readJson<{ rpcId: string; result: { ok: boolean; value?: T; error?: { message?: string } } }>(response)
    if (!body.result.ok) {
      throw new SshApiError(body.result.error?.message ?? `${endpoint} failed`)
    }
    return body.result.value as T
  }

  // ------------------------------------------------------------ connect
  /**
   * The ZCode-style connect flow: streams the NDJSON connection log to
   * `onLog` line by line, resolves when the terminal frame lands.
   */
  async connect(alias: string, callbacks: ConnectCallbacks): Promise<ConnectOutcome> {
    const response = await fetch(SSH_API.connect, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ alias }),
    })
    if (!response.ok || response.body === null) {
      let message = `connect failed: HTTP ${response.status}`
      try {
        const body = await response.json() as { error?: string }
        if (typeof body.error === 'string') message = body.error
      } catch { /* not JSON */ }
      return { ok: false, error: message }
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let outcome: ConnectOutcome | undefined
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.trim() === '') continue
        let parsed: ConnectStreamLine
        try {
          parsed = JSON.parse(line) as ConnectStreamLine
        } catch {
          continue
        }
        if (parsed.type === 'log') {
          callbacks.onLog(parsed.line)
        } else if (parsed.type === 'connected') {
          outcome = { ok: true, latencyMs: parsed.latencyMs, home: parsed.home, ...(parsed.workspace !== undefined ? { workspace: parsed.workspace } : {}) }
        } else if (parsed.type === 'failed') {
          // The final error is surfaced by the returned outcome (the caller
          // renders it); logging it here too would duplicate the line.
          outcome = { ok: false, error: parsed.error }
        }
      }
    }
    return outcome ?? { ok: false, error: 'connect stream ended without a result' }
  }

  async disconnect(alias: string): Promise<boolean> {
    const body = await post<{ ok: boolean }>(SSH_API.disconnect, { alias })
    return body.ok
  }

  // ---------------------------------------------------------------- exec
  async exec(alias: string, command: string, cwd?: string, timeoutMs?: number): Promise<ExecResult> {
    const body = await post<{ result: ExecResult }>(SSH_API.exec, { alias, command, cwd, timeoutMs })
    return body.result
  }

  // ------------------------------------------------------------ file ops
  async ls(alias: string, path: string): Promise<RemoteDirEntry[]> {
    const response = await fetch(SSH_API.ls + query({ alias, path }))
    const body = await readJson<{ entries: RemoteDirEntry[] }>(response)
    return body.entries
  }

  async readFile(alias: string, path: string): Promise<RemoteFileContent> {
    const response = await fetch(SSH_API.read + query({ alias, path }))
    const body = await readJson<{ file: RemoteFileContent }>(response)
    return body.file
  }

  async writeFile(alias: string, path: string, content: string): Promise<{ bytes: number }> {
    return await post<{ bytes: number }>(SSH_API.write, { alias, path, content })
  }

  async mkdir(alias: string, path: string): Promise<void> {
    await post<{ ok: boolean }>(SSH_API.mkdir, { alias, path })
  }

  async rename(alias: string, from: string, to: string): Promise<void> {
    await post<{ ok: boolean }>(SSH_API.rename, { alias, from, to })
  }

  async remove(alias: string, path: string, recursive: boolean): Promise<void> {
    await post<{ ok: boolean }>(SSH_API.remove, { alias, path, recursive })
  }

  // ------------------------------------------------------------ transfer
  /**
   * Upload one file (raw bytes) to a remote path. Progress arrives through
   * the NDJSON response stream; resolves when the result frame lands.
   */
  async uploadFile(
    file: File,
    alias: string,
    remotePath: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<{ transferredBytes: number }> {
    const response = await fetch(SSH_API.upload + query({ alias, remotePath }), {
      method: 'POST',
      body: file,
    })
    if (!response.ok || response.body === null) {
      throw new SshApiError(`upload failed: HTTP ${response.status}`)
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finalError: string | undefined
    let sawResult = false
    let transferredBytes = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.trim() === '') continue
        let parsed: TransferStreamLine
        try {
          parsed = JSON.parse(line) as TransferStreamLine
        } catch {
          continue
        }
        if (parsed.type === 'progress') {
          onProgress?.(parsed.progress)
        } else if (parsed.type === 'result') {
          sawResult = true
          if (parsed.ok) transferredBytes = parsed.transferredBytes ?? 0
          finalError = parsed.ok ? undefined : parsed.error ?? 'upload failed'
        }
      }
    }
    if (finalError !== undefined) throw new SshApiError(finalError)
    if (!sawResult) throw new SshApiError('upload ended without a result frame — the transfer did not complete')
    return { transferredBytes }
  }

  /**
   * Download a remote file with client-side progress. Streams straight to
   * disk when the File System Access API is available (no full-file RAM
   * copy); otherwise falls back to an in-memory Blob.
   */
  async downloadFile(
    alias: string,
    remotePath: string,
    onProgress?: (progress: TransferProgress) => void,
  ): Promise<{ blob?: Blob; filename: string; streamed: boolean; bytes: number }> {
    const response = await fetch(SSH_API.download + query({ alias, remotePath }))
    if (!response.ok || response.body === null) {
      const text = await response.text().catch(() => '')
      throw new SshApiError(text !== '' && text.startsWith('{') ? text : `download failed: HTTP ${response.status}`)
    }
    const total = Number(response.headers.get('content-length') ?? '0')
    const disposition = response.headers.get('content-disposition') ?? ''
    const match = /filename="([^"]+)"/.exec(disposition)
    const filename = match?.[1] ?? remotePath.split('/').pop() ?? 'download'
    const reader = response.body.getReader()
    const picker = typeof window !== 'undefined'
      ? (window as WindowWithFileSystemAccess).showSaveFilePicker
      : undefined
    let streamed = false
    let writable: { write: (data: Uint8Array) => Promise<void>; close: () => Promise<void> } | undefined
    const chunks: Uint8Array<ArrayBuffer>[] = []
    let received = 0
    const progress = (): void => {
      onProgress?.({
        phase: 'transferring',
        file: remotePath,
        transferred: received,
        total,
        percent: total > 0 ? Math.round((received / total) * 1000) / 10 : 0,
      })
    }
    try {
      if (picker !== undefined) {
        const handle = await picker.call(window, { suggestedName: filename })
        writable = await handle.createWritable()
        streamed = true
      }
    } catch {
      // User cancelled the save dialog or the API is unavailable: fall back.
    }
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (writable !== undefined) {
        await writable.write(value as Uint8Array)
      } else {
        chunks.push(value as Uint8Array<ArrayBuffer>)
      }
      received += value.length
      progress()
    }
    if (writable !== undefined) await writable.close()
    onProgress?.({ phase: 'done', file: remotePath, transferred: received, total: received > 0 ? received : total, percent: 100 })
    return {
      blob: streamed ? undefined : new Blob(chunks),
      filename,
      streamed,
      bytes: received,
    }
  }

  // ------------------------------------------------------------ terminal
  /** Open a WebSocket terminal session. */
  openTerminal(alias: string, cols: number, rows: number): TerminalConnection {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url = scheme + '://' + window.location.host + SSH_API.terminal + query({ alias, cols, rows })
    const socket = new WebSocket(url)
    const connection: TerminalConnection = {
      onReady: undefined,
      onOutput: undefined,
      onExit: undefined,
      send: (data) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'input', data } satisfies TerminalClientFrame))
        }
      },
      resize: (cols, rows) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'resize', cols, rows } satisfies TerminalClientFrame))
        }
      },
      close: () => {
        try { socket.close() } catch { /* already closed */ }
      },
    }
    socket.onmessage = (event: MessageEvent<string>) => {
      let frame: TerminalServerFrame
      try {
        frame = JSON.parse(event.data) as TerminalServerFrame
      } catch {
        return
      }
      if (frame.type === 'ready') connection.onReady?.()
      else if (frame.type === 'output') connection.onOutput?.(frame.data)
      else if (frame.type === 'exit') connection.onExit?.(frame.code, frame.error)
    }
    socket.onclose = () => { connection.onExit?.(null, 'connection closed') }
    socket.onerror = () => { connection.onExit?.(null, 'connection error') }
    return connection
  }
}
