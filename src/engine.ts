/**
 * The SSH engine: a per-alias persistent connection pool (ssh2) with jump
 * support, command execution, PTY shells, SFTP file operations and
 * transfers, a connect flow that streams step-by-step logs (the ZCode-style
 * connection log), and per-host liveness status — all living in the host
 * process.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve as resolvePath } from 'node:path'
import { Client, type ConnectConfig } from 'ssh2'
import type { ExecResult, HostStatus, RemoteDirEntry, RemoteFileContent, SshHostEntry, SshHostSummary, TestResult, TransferProgress } from './protocol.ts'
import { expandHome, type HostStore } from './store.ts'
import type { SshSecretReader } from './secrets.ts'

/** Default engine knobs. */
export interface EngineOptions {
  /** Connections idle longer than this are closed (ms). */
  idleTimeoutMs?: number
  /** SSH handshake timeout (ms). */
  connectTimeoutMs?: number
  /** Keepalive ping interval (ms). */
  keepaliveIntervalMs?: number
  /** Cap on captured stdout/stderr bytes per exec. */
  maxOutputBytes?: number
  /** Default exec timeout (ms). */
  defaultExecTimeoutMs?: number
  /** SFTP concurrent channel count for transfers. */
  sftpConcurrency?: number
  /** Cap on remote file reads (bytes). */
  maxFileBytes?: number
  /** Secret reader: resolves passwords / key passphrases per connect. */
  secretReader?: SshSecretReader
}

/** Engine knobs after defaults (secret reader kept separately). */
type ResolvedEngineOptions = Required<Omit<EngineOptions, 'secretReader'>>

const DEFAULTS: ResolvedEngineOptions = {
  idleTimeoutMs: 30 * 60_000,
  connectTimeoutMs: 15_000,
  keepaliveIntervalMs: 15_000,
  maxOutputBytes: 2 * 1024 * 1024,
  defaultExecTimeoutMs: 60_000,
  sftpConcurrency: 8,
  maxFileBytes: 2 * 1024 * 1024,
}

/** One pooled connection record. */
interface PoolRecord {
  client: Client
  /** Jump-chain clients kept alive under the target. */
  hops: Client[]
  idleAt: number
  broken: boolean
  /** Operations currently running on this connection (sweep guard). */
  inFlight: number
  /** Epoch ms of the successful connect (status surface). */
  since: number
}

/** A live PTY shell session. */
export interface ShellSession {
  /** Assign to receive remote output. */
  onData?: (data: Buffer) => void
  /** Assign to be notified when the channel closes. */
  onExit?: (code: number | null, error?: string) => void
  /** Write raw input to the shell. */
  send(data: string): void
  /** Resize the remote PTY. */
  resize(cols: number, rows: number): void
  /** Close the session and its channel. */
  close(): void
  /** Pause remote output delivery (transport backpressure). */
  pause(): void
  /** Resume remote output delivery. */
  resume(): void
}

/** Build the ssh2 connect config for one entry (key read from disk). */
function buildConnectConfig(entry: SshHostEntry, sock: ConnectConfig['sock'] | undefined, secrets: { password?: string; passphrase?: string }, timeoutMs: number, keepaliveMs: number): ConnectConfig {
  const config: ConnectConfig = {
    host: entry.host,
    port: entry.port,
    username: entry.user,
    readyTimeout: timeoutMs,
    keepaliveInterval: keepaliveMs,
    keepaliveCountMax: 3,
  }
  if (sock !== undefined) config.sock = sock
  if (entry.auth.kind === 'password') {
    if (secrets.password !== undefined) config.password = secrets.password
  } else {
    const keyPath = entry.auth.keyPath === undefined ? undefined : expandHome(entry.auth.keyPath)
    if (keyPath === undefined || keyPath === '' || !existsSync(keyPath)) {
      throw new Error(`private key not found: '${entry.auth.keyPath ?? '(unset)'}'`)
    }
    config.privateKey = readFileSync(keyPath, 'utf8')
    if (secrets.passphrase !== undefined && secrets.passphrase !== '') {
      config.passphrase = secrets.passphrase
    }
  }
  return config
}

/** Connect one ssh2 client (resolve on ready, reject on error/close). */
function connectClient(config: ConnectConfig): Promise<Client> {
  return new Promise((resolve, reject) => {
    const client = new Client()
    let settled = false
    client.once('ready', () => {
      if (settled) return
      settled = true
      resolve(client)
    })
    client.once('error', (error) => {
      if (settled) return
      settled = true
      reject(error instanceof Error ? error : new Error(String(error)))
    })
    try {
      client.connect(config)
    } catch (error) {
      if (!settled) {
        settled = true
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    }
  })
}

/** Cap captured output at the byte budget (marks truncation). */
function appendOutput(target: { text: string; truncated: boolean }, chunk: Buffer, maxBytes: number): void {
  if (target.truncated) return
  if (target.text.length + chunk.length > maxBytes) {
    let cut = chunk.toString('utf8').slice(0, maxBytes - target.text.length)
    // Never split a surrogate pair at the cut boundary.
    if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1)
    target.text += cut + '…[output truncated]'
    target.truncated = true
    return
  }
  target.text += chunk.toString('utf8')
}

/**
 * Rebuild an over-budget capture keeping BOTH ends: for command output the
 * tail (errors, exit summaries) is usually what matters most, so keep 60%
 * head + 40% tail with a byte-count marker (mcp-ssh-manager-style output
 * governance).
 */
function retainHeadTail(text: string, maxBytes: number): string {
  if (text.length <= maxBytes) return text
  const head = Math.floor(maxBytes * 0.6)
  const tail = Math.floor(maxBytes * 0.4)
  const dropped = text.length - head - tail
  let headCut = text.slice(0, head)
  if (/[\uD800-\uDBFF]$/.test(headCut)) headCut = headCut.slice(0, -1)
  let tailCut = text.slice(text.length - tail)
  // Never start the tail inside a surrogate pair.
  if (/[\uDC00-\uDFFF]/.test(tailCut[0] ?? '')) tailCut = tailCut.slice(1)
  return `${headCut}\n…[${dropped} bytes truncated]…\n${tailCut}`
}

/** Finalize one output capture: keep both ends when it over-ran the budget. */
function finalizeOutput(target: { text: string; truncated: boolean }, maxBytes: number): string {
  return target.truncated ? retainHeadTail(target.text, maxBytes) : target.text
}

/** Walk a local directory, collecting relative paths of every file. */
function walkLocalDir(root: string): string[] {
  const files: string[] = []
  const visit = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const stat = statSync(full)
      if (stat.isDirectory()) visit(full)
      else if (stat.isFile()) files.push(relative(root, full))
    }
  }
  visit(root)
  return files
}

/** Best-effort binary sniff over a byte prefix. */
function looksBinary(buffer: Buffer): boolean {
  const probe = buffer.subarray(0, 8000)
  if (probe.length === 0) return false
  if (probe.includes(0)) return true
  let controls = 0
  for (const byte of probe) {
    if (byte < 9 || (byte > 13 && byte < 32)) controls += 1
  }
  return controls / probe.length > 0.1
}

/**
 * Channel-level failures ("Channel open failure: open failed", channel
 * errors) mean the pooled connection is unhealthy even though the ssh2
 * client may not have emitted error/close yet (server-side MaxSessions
 * exhaustion, half-dead TCP after network changes). Treat them as
 * connection-fatal so the retry loop reconnects instead of reusing the
 * same dead client three times.
 */
function isChannelFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Channel open failure')
    || message.includes('No response from server')
    || message.includes('Channel closed')
    || message.includes('Connection lost')
}

/**
 * Resolve the auth secrets for one entry from the vault, if present.
 * Returns an empty object when no reader is wired.
 */
export async function resolveEntrySecrets(reader: SshSecretReader | undefined, entry: SshHostEntry): Promise<{ password?: string; passphrase?: string }> {
  if (reader === undefined) return {}
  if (entry.auth.kind === 'password') {
    const password = await reader.getPassword(entry.alias)
    return password !== undefined ? { password } : {}
  }
  const passphrase = await reader.getPassphrase(entry.alias)
  return passphrase !== undefined ? { passphrase } : {}
}

/** Outcome of the logged connect flow. */
export interface ConnectOutcome {
  latencyMs: number
  /** The login shell's home directory (SFTP realpath of '.'). */
  home: string
}

/** Audit log line kinds. */
export type AuditKind = 'connect' | 'exec' | 'write' | 'mkdir' | 'rename' | 'remove' | 'upload' | 'download'

/**
 * Append-only JSONL audit trail (~/.dsh/remote-ssh/audit.jsonl, rotated at
 * 5 MB): every remote side effect logs {ts, kind, alias, detail, ok} —
 * commands and paths, never file contents or secrets.
 */
class AuditLog {
  private readonly path: string
  constructor() {
    const dir = join(homedir(), '.dsh', 'remote-ssh')
    this.path = join(dir, 'audit.jsonl')
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 })
    } catch { /* audit must never break operations */ }
  }
  record(kind: AuditKind, alias: string, detail: string, ok: boolean, extra?: Record<string, unknown>): void {
    try {
      if (existsSync(this.path) && statSync(this.path).size > 5 * 1024 * 1024) {
        renameSync(this.path, this.path + '.1')
      }
      appendFileSync(this.path, JSON.stringify({ ts: new Date().toISOString(), kind, alias, detail: detail.slice(0, 2000), ok, ...extra }) + '\n', { encoding: 'utf8', mode: 0o600 })
    } catch { /* audit must never break operations */ }
  }
}

/**
 * The engine. Owns the pool and all operations. One instance per plugin
 * apply; dispose() closes every connection.
 */
export class SshEngine {
  private readonly store: HostStore
  private readonly opts: ResolvedEngineOptions
  private readonly secretReader: SshSecretReader | undefined
  private readonly pool = new Map<string, PoolRecord>()
  /** Per-alias last failure message (kept until the next success). */
  private readonly lastErrors = new Map<string, string>()
  /** Append-only audit trail of every remote side effect. */
  private readonly audit = new AuditLog()
  /** Per-alias remote command availability (probed once per process). */
  private readonly remoteCmds = new Map<string, Set<string>>()
  private sweepTimer: NodeJS.Timeout | undefined

  /**
   * @param store - the host config store.
   * @param options - engine knobs (defaults applied).
   */
  constructor(store: HostStore, options?: EngineOptions) {
    this.store = store
    this.opts = {
      ...DEFAULTS,
      ...options,
    }
    this.secretReader = options?.secretReader
    this.sweepTimer = setInterval(() => this.sweep(), Math.max(10_000, this.opts.idleTimeoutMs / 4))
    this.sweepTimer.unref?.()
  }

  // ---------------------------------------------------------------- config

  /** Secret-free host list (filtered by the optional query). */
  list(query?: string): SshHostSummary[] {
    const needle = query?.trim().toLowerCase()
    return this.store.list()
      .filter(entry => needle === undefined || needle === ''
        || entry.alias.toLowerCase().includes(needle)
        || (entry.description ?? '').toLowerCase().includes(needle)
        || entry.host.toLowerCase().includes(needle))
      .map(entry => this.store.summarize(entry))
  }

  /** One host summary by alias. */
  find(alias: string): SshHostSummary | undefined {
    const entry = this.store.find(alias)
    return entry === undefined ? undefined : this.store.summarize(entry)
  }

  /** Live connection status for every configured host. */
  status(): HostStatus[] {
    return this.store.list().map(entry => {
      const record = this.pool.get(entry.alias)
      const connected = record !== undefined && !record.broken
      const lastError = this.lastErrors.get(entry.alias)
      return {
        alias: entry.alias,
        connected,
        ...(connected ? { since: record.since } : {}),
        ...(lastError !== undefined ? { lastError } : {}),
      }
    })
  }

  /** Close one host's pooled connection (the disconnect route). */
  disconnect(alias: string): boolean {
    const record = this.pool.get(alias)
    if (record === undefined) return false
    this.disposeRecord(alias, record)
    return true
  }

  // -------------------------------------------------------------- pool

  /**
   * Run `fn` with a live client for `alias`, reconnecting (up to the
   * attempt budget) when the connection broke mid-flight. Channel-level
   * failures mark the record broken so the next attempt truly reconnects.
   */
  private async withClient<T>(alias: string, fn: (client: Client) => Promise<T>, attempts = 3): Promise<T> {
    let lastError: unknown
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      let record = this.pool.get(alias)
      if (record === undefined || record.broken) {
        if (record !== undefined) this.disposeRecord(alias, record)
        record = await this.acquire(alias)
      }
      record.idleAt = Date.now()
      record.inFlight += 1
      try {
        const result = await fn(record.client)
        record.idleAt = Date.now()
        return result
      } catch (error) {
        lastError = error
        if (isChannelFailure(error)) {
          record.broken = true
          this.disposeRecord(alias, record)
        }
      } finally {
        record.inFlight -= 1
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  /**
   * Run `fn` with a fresh SFTP wrapper and ALWAYS close it: every sftp()
   * call opens a new session channel on the connection, and sshd's
   * MaxSessions (default 10) caps concurrently open ones — leaking them
   * exhausts the server and every later channel open fails with
   * "Channel open failure: open failed".
   */
  private async withSftp<T>(alias: string, fn: (sftp: import('ssh2').SFTPWrapper) => Promise<T>): Promise<T> {
    return this.withClient(alias, async (client) => {
      const sftp = await this.sftp(client)
      try {
        return await fn(sftp)
      } finally {
        try { sftp.end() } catch { /* already closed */ }
      }
    })
  }

  /**
   * Build one full jump chain for an entry: hop clients connected through in
   * order, each forwarding a stream to the next destination, ending with the
   * target client. Shared by the pool and standalone shell sessions; every
   * step is narrated to `onLog` when provided.
   */
  private async connectChain(entry: SshHostEntry, onLog?: (line: string) => void): Promise<{ client: Client; hops: Client[] }> {
    const hops: Client[] = []
    let sock: ConnectConfig['sock']
    const chain = entry.proxyJump
    onLog?.(`connecting to ${entry.host}:${entry.port} as ${entry.user} (${entry.auth.kind} auth)`)
    for (let index = 0; index < chain.length; index += 1) {
      const hopAlias = chain[index]
      const hop = this.store.find(hopAlias)
      if (hop === undefined) {
        for (const client of hops) client.end()
        throw new Error(`proxyJump alias '${hopAlias}' not found — create it first`)
      }
      onLog?.(`jump ${index + 1}/${chain.length}: through '${hopAlias}' (${hop.host}:${hop.port})`)
      const hopSecrets = await resolveEntrySecrets(this.secretReader, hop)
      const hopClient = await connectClient(buildConnectConfig(hop, sock, hopSecrets, this.opts.connectTimeoutMs, this.opts.keepaliveIntervalMs))
      hops.push(hopClient)
      const next = index + 1 < chain.length ? this.store.find(chain[index + 1]) : undefined
      const nextHost = next !== undefined ? next.host : entry.host
      const nextPort = next !== undefined ? next.port : entry.port
      sock = await new Promise<ConnectConfig['sock']>((resolve, reject) => {
        hopClient.forwardOut('127.0.0.1', 0, nextHost, nextPort, (error, stream) => {
          if (error !== undefined) {
            for (const client of hops) client.end()
            reject(error)
          } else {
            resolve(stream)
          }
        })
      })
    }
    try {
      const entrySecrets = await resolveEntrySecrets(this.secretReader, entry)
      const client = await connectClient(buildConnectConfig(entry, sock, entrySecrets, this.opts.connectTimeoutMs, this.opts.keepaliveIntervalMs))
      onLog?.('ssh session established')
      return { client, hops }
    } catch (error) {
      for (const client of hops) client.end()
      throw error
    }
  }

  /** In-flight acquire promises, deduped per alias (concurrent first use). */
  private readonly acquireQueue = new Map<string, Promise<PoolRecord>>()

  /** Connect (or reuse) the pooled chain for one alias. */
  private async acquire(alias: string, onLog?: (line: string) => void): Promise<PoolRecord> {
    const pending = this.acquireQueue.get(alias)
    if (pending !== undefined) return pending
    const task = this.doAcquire(alias, onLog)
    this.acquireQueue.set(alias, task)
    try {
      return await task
    } finally {
      if (this.acquireQueue.get(alias) === task) this.acquireQueue.delete(alias)
    }
  }

  private async doAcquire(alias: string, onLog?: (line: string) => void): Promise<PoolRecord> {
    const entry = this.store.find(alias)
    if (entry === undefined) throw new Error(`alias '${alias}' not found — add it first`)
    const { client, hops } = await this.connectChain(entry, onLog)
    const record: PoolRecord = { client, hops, idleAt: Date.now(), broken: false, inFlight: 0, since: Date.now() }
    client.on('error', () => { record.broken = true })
    client.on('close', () => { record.broken = true })
    this.pool.set(alias, record)
    this.lastErrors.delete(alias)
    return record
  }

  /**
   * Tear down one alias's record. When `record` is given and no longer the
   * pooled record for the alias (a concurrent acquire replaced it), nothing
   * is torn down — the connection belongs to someone else now.
   */
  private disposeRecord(alias: string, record?: PoolRecord): void {
    const current = this.pool.get(alias)
    if (record !== undefined && current !== record) return
    if (current === undefined) return
    this.pool.delete(alias)
    try { current.client.end() } catch { /* already closed */ }
    for (const hop of current.hops) {
      try { hop.end() } catch { /* already closed */ }
    }
  }

  /** Close connections idle beyond the threshold (skips in-flight). */
  private sweep(): void {
    const cutoff = Date.now() - this.opts.idleTimeoutMs
    for (const [alias, record] of this.pool) {
      if (record.inFlight === 0 && record.idleAt < cutoff) {
        this.disposeRecord(alias, record)
      }
    }
  }

  // ------------------------------------------------------------- connect

  /**
   * The ZCode-style connect flow: narrate every step to `onLog`, ensure a
   * live connection, probe it, and resolve the login home directory.
   */
  async connectLogged(alias: string, onLog: (line: string) => void): Promise<ConnectOutcome> {
    const entry = this.store.find(alias)
    if (entry === undefined) throw new Error(`alias '${alias}' not found — add it first`)
    const started = Date.now()
    const pooled = this.pool.get(alias)
    if (pooled !== undefined && !pooled.broken) {
      onLog('reusing pooled connection')
      pooled.idleAt = Date.now()
    } else {
      if (pooled !== undefined) this.disposeRecord(alias, pooled)
      await this.acquire(alias, onLog)
    }
    onLog('probing remote shell')
    const probe = await this.exec(alias, 'true', 10_000)
    if (!probe.success) {
      const error = `probe failed: ${probe.error ?? `exit code ${probe.exitCode}`}`
      this.lastErrors.set(alias, error)
      throw new Error(error)
    }
    const home = await this.withSftp(alias, async sftp => {
      return await new Promise<string>((resolve, reject) => {
        sftp.realpath('.', (error, absPath) => error !== undefined ? reject(error) : resolve(absPath))
      })
    })
    const latencyMs = Date.now() - started
    onLog(`connected — home directory ${home}`)
    this.audit.record('connect', alias, home, true, { latencyMs })
    return { latencyMs, home }
  }

  // --------------------------------------------------------------- exec

  /**
   * Whether a command exists on the remote (probed once per alias per
   * process, cached). Lets callers prefer ripgrep and fall back to
   * find/grep on hosts without it.
   */
  async hasCmd(alias: string, cmd: string): Promise<boolean> {
    let known = this.remoteCmds.get(alias)
    if (known === undefined) {
      known = new Set()
      this.remoteCmds.set(alias, known)
    }
    if (known.has(cmd)) return true
    const probe = await this.exec(alias, `command -v ${cmd}`, 10_000)
    if (probe.success && probe.stdout.trim() !== '') {
      known.add(cmd)
      return true
    }
    return false
  }

  /** Run one command on `alias` (reusing the pooled connection). */
  async exec(alias: string, command: string, timeoutMs?: number): Promise<ExecResult> {
    const started = Date.now()
    const budget = timeoutMs !== undefined && timeoutMs > 0 ? timeoutMs : this.opts.defaultExecTimeoutMs
    try {
      const result = await this.withClient(alias, async (client) => {
        return await new Promise<ExecResult>((resolve, reject) => {
          client.exec(command, (error, stream) => {
            if (error !== undefined) {
              reject(error)
              return
            }
            const stdout = { text: '', truncated: false }
            const stderr = { text: '', truncated: false }
            let timedOut = false
            let settled = false
            const finish = (): void => {
              if (settled) return
              settled = true
              clearTimeout(timer)
              resolve({
                success: false,
                exitCode: null,
                timedOut,
                stdout: finalizeOutput(stdout, this.opts.maxOutputBytes),
                stderr: finalizeOutput(stderr, this.opts.maxOutputBytes),
                durationMs: Date.now() - started,
                error: timedOut ? `command timed out after ${budget} ms` : undefined,
              })
            }
            const timer = setTimeout(() => {
              timedOut = true
              try { stream.signal('KILL') } catch { /* channel gone */ }
              try { stream.close() } catch { /* channel gone */ }
              // Hard deadline: settle now even if the peer never acks the
              // channel close (the stream 'close' handler is then a no-op).
              finish()
            }, budget)
            stream.on('data', (chunk: Buffer) => appendOutput(stdout, chunk, this.opts.maxOutputBytes))
            stream.stderr.on('data', (chunk: Buffer) => appendOutput(stderr, chunk, this.opts.maxOutputBytes))
            stream.on('close', (code: number | null) => {
              if (settled) return
              settled = true
              clearTimeout(timer)
              resolve({
                success: code === 0 && !timedOut,
                exitCode: code,
                timedOut,
                stdout: finalizeOutput(stdout, this.opts.maxOutputBytes),
                stderr: finalizeOutput(stderr, this.opts.maxOutputBytes),
                durationMs: Date.now() - started,
              })
            })
            stream.on('error', (streamError: Error) => {
              if (settled) return
              settled = true
              clearTimeout(timer)
              reject(streamError)
            })
          })
        })
      })
      this.audit.record('exec', alias, command, result.success, { exitCode: result.exitCode, durationMs: result.durationMs })
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.lastErrors.set(alias, message)
      this.audit.record('exec', alias, command, false, { error: message })
      return {
        success: false,
        exitCode: null,
        timedOut: false,
        stdout: '',
        stderr: '',
        durationMs: Date.now() - started,
        error: message,
      }
    }
  }

  // -------------------------------------------------------------- shell

  /** Open a PTY shell session for the web terminal (standalone connection). */
  async openShell(alias: string, size: { cols: number; rows: number }): Promise<ShellSession> {
    const entry = this.store.find(alias)
    if (entry === undefined) throw new Error(`alias '${alias}' not found — add it first`)
    // The shell is a long-lived exclusive stream: use its own connection so
    // closing it can never tear down a pooled exec sharing the alias.
    const { client, hops } = await this.connectChain(entry)
    return await new Promise<ShellSession>((resolve, reject) => {
      client.shell({ term: 'xterm-256color', cols: size.cols, rows: size.rows }, (error, stream) => {
        if (error !== undefined) {
          try { client.end() } catch { /* closed */ }
          for (const hop of hops) { try { hop.end() } catch { /* closed */ } }
          reject(error)
          return
        }
        let tornDown = false
        const teardown = (): void => {
          if (tornDown) return
          tornDown = true
          try { client.end() } catch { /* closed */ }
          for (const hop of hops) { try { hop.end() } catch { /* closed */ } }
        }
        const session: ShellSession = {
          send: (data) => { try { stream.write(data) } catch { /* channel gone */ } },
          resize: (cols, rows) => { try { stream.setWindow(rows, cols, rows, cols) } catch { /* channel gone */ } },
          close: () => {
            try { stream.close() } catch { /* channel gone */ }
            teardown()
          },
          pause: () => { try { stream.pause() } catch { /* channel gone */ } },
          resume: () => { try { stream.resume() } catch { /* channel gone */ } },
        }
        stream.on('data', (chunk: Buffer) => { session.onData?.(chunk) })
        stream.on('close', (code: number | null) => {
          teardown()
          session.onExit?.(code)
        })
        stream.on('error', (streamError: Error) => {
          teardown()
          session.onExit?.(null, streamError instanceof Error ? streamError.message : String(streamError))
        })
        resolve(session)
      })
    })
  }

  // -------------------------------------------------------------- sftp

  /** Upload one local file (or directory tree) to a remote path. */
  async upload(alias: string, localPath: string, remotePath: string, recursive: boolean, onProgress?: (progress: TransferProgress) => void): Promise<{ bytes: number; files: number }> {
    // Remote paths must be absolute: the mkdir chain and fastPut must agree
    // on one resolution.
    if (!remotePath.startsWith('/')) {
      throw new Error(`remotePath must be an absolute path (got '${remotePath}')`)
    }
    const local = resolvePath(localPath)
    if (!existsSync(local)) throw new Error(`local path not found: '${localPath}'`)
    return this.withSftp(alias, async (sftp) => {
      const stat = statSync(local)
      let files: string[]
      if (stat.isDirectory()) {
        if (!recursive) throw new Error(`'${localPath}' is a directory — enable recursive upload`)
        files = walkLocalDir(local)
        await this.ensureRemoteDir(sftp, remotePath)
      } else {
        files = ['']
        await this.ensureRemoteDir(sftp, dirname(remotePath))
      }
      let bytes = 0
      for (const rel of files) {
        const src = rel === '' ? local : join(local, rel)
        // Remote paths always use forward slashes; normalize any OS separators.
        const remoteRel = rel.split(/[\\/]/).join('/')
        const dst = rel === '' ? remotePath : remotePath.replace(/\/$/, '') + '/' + remoteRel
        await this.fastPut(sftp, src, dst, onProgress)
        bytes += statSync(src).size
      }
      return { bytes, files: files.length }
    })
  }

  /** Download one remote file to a local path. */
  async download(alias: string, remotePath: string, localPath: string, onProgress?: (progress: TransferProgress) => void): Promise<{ bytes: number }> {
    return this.withSftp(alias, async (sftp) => {
      const stat = await new Promise<{ isDirectory: () => boolean }>((resolve, reject) => {
        sftp.stat(remotePath, (error, stats) => error !== undefined ? reject(error) : resolve(stats))
      })
      if (stat.isDirectory()) {
        throw new Error(`'${remotePath}' is a directory — directory download is not supported yet (download individual files)`)
      }
      const local = resolvePath(localPath)
      if (!existsSync(dirname(local))) mkdirSync(dirname(local), { recursive: true })
      await this.fastGet(sftp, remotePath, local, onProgress)
      return { bytes: statSync(local).size }
    })
  }

  /** List a remote directory (file browser). */
  async ls(alias: string, path: string): Promise<RemoteDirEntry[]> {
    return this.withSftp(alias, async (sftp) => {
      return await new Promise((resolve, reject) => {
        sftp.readdir(path, (error, list) => {
          if (error !== undefined) {
            reject(error)
            return
          }
          const entries: RemoteDirEntry[] = list.map(item => ({
            name: item.filename,
            type: item.attrs.isDirectory() ? 'dir' : item.attrs.isFile() ? 'file' : 'other',
            size: item.attrs.size,
            mtimeMs: item.attrs.mtime * 1000,
            mode: item.attrs.mode,
          }))
          entries.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
          resolve(entries)
        })
      })
    })
  }

  /** Read one remote file as text (byte-capped, binary-flagged). */
  async readFile(alias: string, path: string, maxBytes?: number): Promise<RemoteFileContent> {
    const budget = maxBytes !== undefined && maxBytes > 0 ? Math.min(maxBytes, this.opts.maxFileBytes) : this.opts.maxFileBytes
    return this.withSftp(alias, async (sftp) => {
      const stat = await new Promise<{ size: number; isFile: () => boolean }>((resolve, reject) => {
        sftp.stat(path, (error, stats) => error !== undefined ? reject(error) : resolve({ size: stats.size, isFile: () => stats.isFile() }))
      })
      if (!stat.isFile()) throw new Error(`'${path}' is not a regular file`)
      const read = Math.min(stat.size, budget)
      const chunks: Buffer[] = []
      let received = 0
      await new Promise<void>((resolve, reject) => {
        const stream = sftp.createReadStream(path, { start: 0, end: read - 1 })
        stream.on('data', (chunk: Buffer) => { chunks.push(chunk); received += chunk.length })
        stream.on('error', reject)
        stream.on('close', resolve)
      })
      const buffer = Buffer.concat(chunks)
      return {
        path,
        content: buffer.toString('utf8'),
        bytes: stat.size,
        truncated: stat.size > read,
        binary: looksBinary(buffer),
      }
    })
  }

  /** Write text to one remote file (creates or truncates). */
  async writeFile(alias: string, path: string, content: string): Promise<{ bytes: number }> {
    if (!path.startsWith('/')) throw new Error('remote path must be absolute')
    const payload = Buffer.from(content, 'utf8')
    await this.withSftp(alias, async (sftp) => {
      await new Promise<void>((resolve, reject) => {
        const stream = sftp.createWriteStream(path)
        stream.on('error', reject)
        stream.on('close', () => resolve())
        stream.end(payload)
      })
    })
    return { bytes: payload.length }
  }

  /** Create one remote directory (single level). */
  async mkdir(alias: string, path: string): Promise<void> {
    await this.withSftp(alias, async (sftp) => {
      await new Promise<void>((resolve, reject) => {
        sftp.mkdir(path, error => error !== undefined ? reject(error) : resolve())
      })
    })
  }

  /** Rename/move one remote path. */
  async rename(alias: string, fromPath: string, toPath: string): Promise<void> {
    await this.withSftp(alias, async (sftp) => {
      await new Promise<void>((resolve, reject) => {
        const done = (error?: Error | null): void => {
          if (error === undefined || error === null) resolve()
          else reject(error)
        }
        // posix-rename@openssh.com overwrites the destination atomically;
        // plain rename is the portable fallback.
        if (typeof sftp.ext_openssh_rename === 'function') {
          sftp.ext_openssh_rename(fromPath, toPath, done)
        } else {
          sftp.rename(fromPath, toPath, done)
        }
      })
    })
  }

  /** Delete one remote file or directory (recursive opt-in for directories). */
  async remove(alias: string, path: string, recursive: boolean): Promise<void> {
    if (recursive) {
      // Recursive delete rides one exec channel (rm -rf), not SFTP.
      const safe = path.replaceAll("'", `'"'"'`)
      const result = await this.exec(alias, `rm -rf -- '${safe}'`)
      if (!result.success) {
        throw new Error(`recursive delete failed: ${result.stderr || result.error || `exit code ${result.exitCode}`}`)
      }
      this.audit.record('remove', alias, path, true, { recursive })
      return
    }
    await this.withSftp(alias, async (sftp) => {
      const stat = await new Promise<{ isDirectory: () => boolean }>((resolve, reject) => {
        sftp.stat(path, (error, stats) => error !== undefined ? reject(error) : resolve(stats))
      })
      if (stat.isDirectory()) {
        await new Promise<void>((resolve, reject) => {
          sftp.rmdir(path, error => error !== undefined ? reject(new Error(String(error))) : resolve())
        })
        return
      }
      await new Promise<void>((resolve, reject) => {
        sftp.unlink(path, error => error !== undefined ? reject(new Error(String(error))) : resolve())
      })
    })
    this.audit.record('remove', alias, path, true, { recursive })
  }

  /** Canonicalize a remote path ('.' → home). */
  async realpath(alias: string, path: string): Promise<string> {
    return this.withSftp(alias, async (sftp) => {
      return await new Promise<string>((resolve, reject) => {
        sftp.realpath(path, (error, absPath) => error !== undefined ? reject(error) : resolve(absPath))
      })
    })
  }

  private sftp(client: Client): Promise<import('ssh2').SFTPWrapper> {
    return new Promise((resolve, reject) => {
      client.sftp((error, sftp) => error !== undefined ? reject(error) : resolve(sftp))
    })
  }

  /** Create a remote directory chain (stat-then-mkdir per segment). */
  private ensureRemoteDir(sftp: import('ssh2').SFTPWrapper, remote: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const segments = remote.replace(/^\/+/, '').split('/').filter(segment => segment !== '')
      const walk = (index: number): void => {
        if (index >= segments.length) {
          resolve()
          return
        }
        const current = '/' + segments.slice(0, index + 1).join('/')
        sftp.stat(current, (statError) => {
          if (statError === undefined) {
            walk(index + 1)
            return
          }
          // Statting a missing path fails; mkdir it (idempotent because the
          // stat check runs first — some sftp servers throw on EEXIST).
          sftp.mkdir(current, (mkdirError) => {
            if (mkdirError !== undefined) {
              reject(mkdirError)
              return
            }
            walk(index + 1)
          })
        })
      }
      walk(0)
    })
  }

  private fastPut(sftp: import('ssh2').SFTPWrapper, src: string, dst: string, onProgress?: (progress: TransferProgress) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      let last = 0
      let lastEmit = 0
      const started = Date.now()
      onProgress?.({ phase: 'transferring', file: dst, transferred: 0, total: statSync(src).size, percent: 0 })
      sftp.fastPut(src, dst, { concurrency: this.opts.sftpConcurrency, step: (transferred: number, _chunk: number, total: number) => {
        const now = Date.now()
        // Throttle: the UI only needs ~10 frames per second.
        if (now - lastEmit < 100 && transferred < total) return
        lastEmit = now
        const elapsed = (now - started) / 1000
        onProgress?.({
          phase: 'transferring',
          file: dst,
          transferred,
          total,
          percent: total > 0 ? Math.round((transferred / total) * 1000) / 10 : 0,
          speedBps: elapsed > 0 ? Math.round((transferred - last) / elapsed) : undefined,
        })
        last = transferred
      } }, (error) => {
        if (error !== undefined) {
          onProgress?.({ phase: 'error', file: dst, transferred: 0, total: 0, percent: 0, error: String(error) })
          reject(error)
        } else {
          onProgress?.({ phase: 'done', file: dst, transferred: statSync(src).size, total: statSync(src).size, percent: 100 })
          resolve()
        }
      })
    })
  }

  private fastGet(sftp: import('ssh2').SFTPWrapper, src: string, dst: string, onProgress?: (progress: TransferProgress) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      let last = 0
      let lastEmit = 0
      const started = Date.now()
      sftp.fastGet(src, dst, { concurrency: this.opts.sftpConcurrency, step: (transferred: number, _chunk: number, total: number) => {
        const now = Date.now()
        if (now - lastEmit < 100 && transferred < total) return
        lastEmit = now
        const elapsed = (now - started) / 1000
        onProgress?.({
          phase: 'transferring',
          file: src,
          transferred,
          total,
          percent: total > 0 ? Math.round((transferred / total) * 1000) / 10 : 0,
          speedBps: elapsed > 0 ? Math.round((transferred - last) / elapsed) : undefined,
        })
        last = transferred
      } }, (error) => {
        if (error !== undefined) {
          onProgress?.({ phase: 'error', file: src, transferred: 0, total: 0, percent: 0, error: String(error) })
          reject(error)
        } else {
          onProgress?.({ phase: 'done', file: src, transferred: statSync(dst).size, total: statSync(dst).size, percent: 100 })
          resolve()
        }
      })
    })
  }

  // ------------------------------------------------------------- misc

  /** Probe connectivity: connect, run `true`, close nothing (pooled). */
  async test(alias: string): Promise<TestResult> {
    const started = Date.now()
    try {
      const result = await this.exec(alias, 'true', 10_000)
      return result.success
        ? { ok: true, latencyMs: result.durationMs }
        : { ok: false, latencyMs: result.durationMs, error: `remote exit code ${result.exitCode}` }
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /** Close every pooled connection. */
  dispose(): void {
    if (this.sweepTimer !== undefined) clearInterval(this.sweepTimer)
    for (const alias of [...this.pool.keys()]) this.disposeRecord(alias)
  }
}
