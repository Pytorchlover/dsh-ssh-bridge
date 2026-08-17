/**
 * The /api/remote-ssh route family: host CRUD, ~/.ssh/config alias reading
 * and import, recents, status, the NDJSON connect log stream, exec, remote
 * file operations (ls / read / write / mkdir / rename / remove), SFTP
 * transfer (NDJSON progress stream for uploads, binary stream for
 * downloads), and the WebSocket PTY terminal upgrade. Every route carries a
 * loopback-only trust fence (plus browser same-origin markers) — these
 * endpoints operate remote servers, so LAN-exposed dsh web deployments must
 * not serve them.
 */

import { createReadStream, createWriteStream, mkdirSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { WebSocket, WebSocketServer } from 'ws'
import type { WebRoute, WebUpgradeRoute } from '@deepseek-ai/dsh-host-webserver'
import type { SshEngine, ShellSession } from './engine.ts'
import { SSH_API, withCwd, type HostPayload, type SessionBindPayload, type TerminalClientFrame, type TerminalServerFrame } from './protocol.ts'
import type { HostStore } from './store.ts'
import type { SshVault } from './secrets.ts'
import type { RemoteBindings } from './remote-session.ts'
import { createMarkerWorkspace } from './workspace-marker.ts'

/** Cap on JSON request bodies (host entries and exec payloads are small). */
const MAX_JSON_BODY_BYTES = 8 * 1024 * 1024

/** Cap on declared upload bodies (staged to disk before SFTP). */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024

/**
 * One noServer WebSocket server for terminal upgrades: the browser half uses
 * a standards-compliant WebSocket, so the host must speak real RFC 6455
 * frames (the webserver hands us the raw upgraded socket).
 */
const terminalWss = new WebSocketServer({ noServer: true })

/** Pause the shell when the socket's send buffer exceeds this… */
const BACKPRESSURE_HIGH_WATER = 1024 * 1024

/** …and resume once it drains below this. */
const BACKPRESSURE_LOW_WATER = 512 * 1024

/** Loopback literal check plus browser same-origin markers. */
function isLoopbackRequest(request: IncomingMessage): boolean {
  const address = request.socket.remoteAddress
  if (address !== '127.0.0.1' && address !== '::1' && address !== '::ffff:127.0.0.1') return false
  const host = request.headers.host
  if (typeof host !== 'string') return false
  let hostUrl: URL
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return false
  }
  if (hostUrl.hostname !== '127.0.0.1' && hostUrl.hostname !== 'localhost' && hostUrl.hostname !== '[::1]') return false
  if (request.headers['sec-fetch-site'] === 'cross-site') return false
  const origin = request.headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

/** One JSON response. */
function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'referrer-policy': 'no-referrer' })
  res.end(payload)
}

/** Read a JSON request body (undefined when too large or unparseable). */
async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > MAX_JSON_BODY_BYTES) return undefined
    chunks.push(buffer)
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

/** URL query helper (first value, decoded). */
function queryParam(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name)
  return value === null ? undefined : value
}

/** Route family dependencies. */
export interface SshRoutesDeps {
  /** The host store (CRUD). */
  store: HostStore
  /** The engine (ops). */
  engine: SshEngine
  /** Remote-session bindings (the session route). */
  bindings: RemoteBindings
  /**
   * Secret vault: receives secrets on create/update, forgets them on delete,
   * queried by the engine at connect time. Optional so tests can omit it.
   */
  vault?: SshVault
  /** Temp dir for upload/download staging (tests inject a sandbox). */
  stagingDir?: string
}

/**
 * Build every /api/remote-ssh route (exact paths) plus the terminal upgrade.
 * @param deps - store, engine, vault, staging dir.
 * @returns routes and the upgrade route.
 */
export function makeRoutes(deps: SshRoutesDeps): { routes: WebRoute[]; upgrade: WebUpgradeRoute } {
  const { store, engine, bindings, vault } = deps
  const staging = deps.stagingDir ?? join(tmpdir(), 'dsh-remote-ssh-uploads')
  // The upload route stages request bodies here; it must exist before the
  // first request (a missing dir would hang the first upload forever).
  mkdirSync(staging, { recursive: true })

  /** Guard helper: fence + method check. */
  const guard = (req: IncomingMessage, res: ServerResponse, method: string): boolean => {
    if (!isLoopbackRequest(req)) {
      writeJson(res, 403, { error: 'forbidden: loopback-only' })
      return false
    }
    if (req.method !== method) {
      writeJson(res, 405, { error: `method not allowed: ${req.method}` })
      return false
    }
    return true
  }

  const routes: WebRoute[] = [
    // ------------------------------------------------------------ hosts
    {
      kind: 'exact',
      path: SSH_API.hosts,
      handler: async (req, res) => {
        // One handler per path (the webserver keyed route registry rejects
        // duplicate (kind, path)); dispatch by HTTP method here.
        const method = req.method ?? 'GET'
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: 'forbidden: loopback-only' })
          return
        }
        const url = new URL(req.url ?? '/', 'http://localhost')
        if (method === 'GET') {
          writeJson(res, 200, { hosts: engine.list(queryParam(url, 'query')) })
          return
        }
        if (method === 'POST') {
          const body = await readJsonBody(req)
          if (body === undefined) {
            writeJson(res, 400, { error: 'invalid JSON body' })
            return
          }
          try {
            // Route write-only secrets into the vault before anything touches
            // the store; the store only ever persists the secret-free form.
            const alias = typeof body.alias === 'string' ? body.alias : ''
            const auth = body.auth as Record<string, unknown> | undefined
            if (vault !== undefined && auth !== undefined) {
              if (typeof auth.password === 'string' && auth.password !== '') {
                await vault.setPassword(alias, auth.password)
              }
              if (typeof auth.passphrase === 'string' && auth.passphrase !== '') {
                await vault.setPassphrase(alias, auth.passphrase)
              }
            }
            const entry = store.create(body as unknown as HostPayload)
            writeJson(res, 201, { host: store.summarize(entry) })
          } catch (error) {
            writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
          }
          return
        }
        if (method !== 'PATCH' && method !== 'DELETE') {
          writeJson(res, 405, { error: `method not allowed: ${method}` })
          return
        }
        const alias = queryParam(url, 'alias')
        if (alias === undefined || alias === '') {
          writeJson(res, 400, { error: 'alias query parameter is required' })
          return
        }
        if (method === 'PATCH') {
          const body = await readJsonBody(req)
          if (body === undefined) {
            writeJson(res, 400, { error: 'invalid JSON body' })
            return
          }
          try {
            // Same write-only handling as POST: non-empty new secrets go into
            // the vault; an omitted secret keeps what is already stored.
            const auth = body.auth as Record<string, unknown> | undefined
            if (vault !== undefined && auth !== undefined) {
              if (typeof auth.password === 'string' && auth.password !== '') {
                await vault.setPassword(alias, auth.password)
              }
              if (typeof auth.passphrase === 'string' && auth.passphrase !== '') {
                await vault.setPassphrase(alias, auth.passphrase)
              }
            }
            const entry = store.update(alias, body as unknown as Partial<HostPayload>)
            writeJson(res, 200, { host: store.summarize(entry) })
          } catch (error) {
            writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
          }
          return
        }
        if (method === 'DELETE') {
          try {
            engine.disconnect(alias)
            store.delete(alias)
            if (vault !== undefined) await vault.clear(alias)
            writeJson(res, 200, { ok: true })
          } catch (error) {
            writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
          }
          return
        }
        writeJson(res, 405, { error: `method not allowed: ${method}` })
      },
    },
    // ------------------------------------------------- ~/.ssh/config
    {
      kind: 'exact',
      path: SSH_API.sshAliases,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        writeJson(res, 200, { aliases: store.listSshConfigAliases() })
      },
    },
    {
      kind: 'exact',
      path: SSH_API.importSshConfig,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        try {
          writeJson(res, 200, { result: store.importFromSshConfig() })
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    // ------------------------------------------------------------ recents
    {
      kind: 'exact',
      path: SSH_API.recents,
      handler: async (req, res) => {
        const method = req.method ?? 'GET'
        if (!isLoopbackRequest(req)) {
          writeJson(res, 403, { error: 'forbidden: loopback-only' })
          return
        }
        if (method === 'GET') {
          writeJson(res, 200, { recents: store.listRecents() })
          return
        }
        if (method !== 'POST') {
          writeJson(res, 405, { error: `method not allowed: ${method}` })
          return
        }
        const body = await readJsonBody(req)
        const alias = typeof body?.alias === 'string' ? body.alias : ''
        const dir = typeof body?.dir === 'string' ? body.dir : ''
        if (alias === '' || dir === '') {
          writeJson(res, 400, { error: 'alias and dir are required' })
          return
        }
        store.addRecent(alias, dir)
        writeJson(res, 200, { ok: true })
      },
    },
    // ------------------------------------------------------------- status
    {
      kind: 'exact',
      path: SSH_API.status,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        writeJson(res, 200, { status: engine.status() })
      },
    },
    // ------------------------------------------------------ remote session
    {
      kind: 'exact',
      path: SSH_API.session,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req) as SessionBindPayload | undefined
        const action = body?.action
        if (action === 'bind') {
          const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
          const alias = typeof body?.alias === 'string' ? body.alias : ''
          const dir = typeof body?.dir === 'string' ? body.dir : ''
          if (sessionId === '' || alias === '' || dir === '') {
            writeJson(res, 400, { error: 'sessionId, alias and dir are required' })
            return
          }
          if (store.find(alias) === undefined) {
            writeJson(res, 400, { error: `alias '${alias}' not found` })
            return
          }
          bindings.bind(sessionId, alias, dir)
          writeJson(res, 200, { binding: { alias, dir }, bindings: bindings.list() })
          return
        }
        if (action === 'unbind') {
          const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
          if (sessionId === '') {
            writeJson(res, 400, { error: 'sessionId is required' })
            return
          }
          bindings.unbind(sessionId)
          writeJson(res, 200, { bindings: bindings.list() })
          return
        }
        if (action === 'list') {
          writeJson(res, 200, { bindings: bindings.list() })
          return
        }
        writeJson(res, 400, { error: `unknown action '${String(action)}'` })
      },
    },
    // ------------------------------------------------- remote workspaces
    {
      kind: 'exact',
      path: SSH_API.workspace,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const alias = typeof body?.alias === 'string' ? body.alias : ''
        const dir = typeof body?.dir === 'string' ? body.dir : ''
        if (alias === '' || dir === '' || !dir.startsWith('/')) {
          writeJson(res, 400, { error: 'alias and an absolute dir are required' })
          return
        }
        if (store.find(alias) === undefined) {
          writeJson(res, 400, { error: `alias '${alias}' not found` })
          return
        }
        // Validate connectivity before materializing the workspace.
        try {
          const probe = await engine.test(alias)
          if (!probe.ok) {
            writeJson(res, 400, { error: `cannot reach '${alias}': ${probe.error ?? 'unreachable'}` })
            return
          }
        } catch (error) {
          writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
          return
        }
        const path = createMarkerWorkspace(alias, dir)
        writeJson(res, 200, { path, title: `${alias} · ${dir}` })
      },
    },
    // ------------------------------------------------------------ connect
    {
      kind: 'exact',
      path: SSH_API.connect,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const alias = typeof body?.alias === 'string' ? body.alias : ''
        if (alias === '') {
          writeJson(res, 400, { error: 'alias is required' })
          return
        }
        // The ZCode-style connect log: NDJSON lines, terminal frame last.
        res.writeHead(200, {
          'content-type': 'application/x-ndjson; charset=utf-8',
          'cache-control': 'no-cache',
          'referrer-policy': 'no-referrer',
        })
        const emit = (line: unknown): void => {
          try { res.write(JSON.stringify(line) + '\n') } catch { /* client gone */ }
        }
        try {
          const outcome = await engine.connectLogged(alias, line => emit({ type: 'log', line }))
          const entry = store.find(alias)
          if (entry !== undefined && entry.workspace !== undefined && entry.workspace !== '') {
            store.addRecent(alias, entry.workspace)
          }
          emit({ type: 'connected', alias, latencyMs: outcome.latencyMs, home: outcome.home, ...(entry?.workspace !== undefined ? { workspace: entry.workspace } : {}) })
        } catch (error) {
          emit({ type: 'failed', alias, error: error instanceof Error ? error.message : String(error) })
        } finally {
          try { res.end() } catch { /* closed */ }
        }
      },
    },
    {
      kind: 'exact',
      path: SSH_API.disconnect,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const alias = typeof body?.alias === 'string' ? body.alias : ''
        if (alias === '') {
          writeJson(res, 400, { error: 'alias is required' })
          return
        }
        writeJson(res, 200, { ok: engine.disconnect(alias) })
      },
    },
    // --------------------------------------------------------------- exec
    {
      kind: 'exact',
      path: SSH_API.exec,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const alias = typeof body?.alias === 'string' ? body.alias : ''
        const command = typeof body?.command === 'string' ? body.command : ''
        if (alias === '' || command === '') {
          writeJson(res, 400, { error: 'alias and command are required' })
          return
        }
        const cwd = typeof body?.cwd === 'string' && body.cwd !== '' ? body.cwd : undefined
        const timeoutMs = typeof body?.timeoutMs === 'number' ? body.timeoutMs : undefined
        try {
          writeJson(res, 200, { result: await engine.exec(alias, withCwd(command, cwd), timeoutMs) })
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    // ----------------------------------------------------------- file ops
    {
      kind: 'exact',
      path: SSH_API.ls,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        const url = new URL(req.url ?? '/', 'http://localhost')
        const alias = queryParam(url, 'alias')
        const path = queryParam(url, 'path') ?? '/'
        if (alias === undefined || alias === '') {
          writeJson(res, 400, { error: 'alias query parameter is required' })
          return
        }
        try {
          writeJson(res, 200, { entries: await engine.ls(alias, path) })
        } catch (error) {
          writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: SSH_API.read,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        const url = new URL(req.url ?? '/', 'http://localhost')
        const alias = queryParam(url, 'alias')
        const path = queryParam(url, 'path')
        if (alias === undefined || path === undefined) {
          writeJson(res, 400, { error: 'alias and path query parameters are required' })
          return
        }
        const maxBytesRaw = Number(queryParam(url, 'maxBytes') ?? '')
        const maxBytes = Number.isFinite(maxBytesRaw) && maxBytesRaw > 0 ? maxBytesRaw : undefined
        try {
          writeJson(res, 200, { file: await engine.readFile(alias, path, maxBytes) })
        } catch (error) {
          writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: SSH_API.write,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const alias = typeof body?.alias === 'string' ? body.alias : ''
        const path = typeof body?.path === 'string' ? body.path : ''
        const content = typeof body?.content === 'string' ? body.content : ''
        if (alias === '' || path === '') {
          writeJson(res, 400, { error: 'alias and path are required' })
          return
        }
        try {
          writeJson(res, 200, await engine.writeFile(alias, path, content))
        } catch (error) {
          writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: SSH_API.mkdir,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const alias = typeof body?.alias === 'string' ? body.alias : ''
        const path = typeof body?.path === 'string' ? body.path : ''
        if (alias === '' || path === '') {
          writeJson(res, 400, { error: 'alias and path are required' })
          return
        }
        try {
          await engine.mkdir(alias, path)
          writeJson(res, 200, { ok: true })
        } catch (error) {
          writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: SSH_API.rename,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const alias = typeof body?.alias === 'string' ? body.alias : ''
        const from = typeof body?.from === 'string' ? body.from : ''
        const to = typeof body?.to === 'string' ? body.to : ''
        if (alias === '' || from === '' || to === '') {
          writeJson(res, 400, { error: 'alias, from and to are required' })
          return
        }
        try {
          await engine.rename(alias, from, to)
          writeJson(res, 200, { ok: true })
        } catch (error) {
          writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    {
      kind: 'exact',
      path: SSH_API.remove,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const body = await readJsonBody(req)
        const alias = typeof body?.alias === 'string' ? body.alias : ''
        const path = typeof body?.path === 'string' ? body.path : ''
        const recursive = body?.recursive === true
        if (alias === '' || path === '') {
          writeJson(res, 400, { error: 'alias and path are required' })
          return
        }
        try {
          await engine.remove(alias, path, recursive)
          writeJson(res, 200, { ok: true })
        } catch (error) {
          writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    },
    // --------------------------------------------------------- upload
    {
      kind: 'exact',
      path: SSH_API.upload,
      handler: async (req, res) => {
        if (!guard(req, res, 'POST')) return
        const url = new URL(req.url ?? '/', 'http://localhost')
        const alias = queryParam(url, 'alias')
        const remotePath = queryParam(url, 'remotePath')
        if (alias === undefined || remotePath === undefined) {
          writeJson(res, 400, { error: 'alias and remotePath query parameters are required' })
          return
        }
        const declared = Number(req.headers['content-length'])
        if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) {
          writeJson(res, 413, { error: 'upload body too large' })
          return
        }
        res.writeHead(200, {
          'content-type': 'application/x-ndjson; charset=utf-8',
          'cache-control': 'no-cache',
          'referrer-policy': 'no-referrer',
        })
        const emit = (line: unknown): void => {
          try { res.write(JSON.stringify(line) + '\n') } catch { /* client gone */ }
        }
        // Stage the uploaded bytes, then SFTP them out with progress frames.
        const tmp = join(staging, `upload-${randomBytes(6).toString('hex')}`)
        const sink = createWriteStream(tmp)
        let settled = false
        // Every terminal path (sink error, client abort, response loss) must
        // emit a result frame, end the response, and remove the tmp file.
        const fail = (error: unknown): void => {
          if (settled) return
          settled = true
          emit({ type: 'result', ok: false, error: error instanceof Error ? error.message : String(error) })
          try { sink.destroy() } catch { /* closed */ }
          void unlink(tmp).catch(() => undefined)
          try { res.end() } catch { /* closed */ }
        }
        const done = (): void => {
          if (settled) return
          settled = true
          try { res.end() } catch { /* closed */ }
        }
        sink.on('error', (error) => fail(error))
        req.on('error', (error) => fail(error))
        req.on('aborted', () => fail('upload aborted by the client'))
        res.on('error', () => fail('response stream closed'))
        res.on('close', () => { if (!res.writableEnded) fail('connection closed') })
        req.pipe(sink)
        sink.on('finish', async () => {
          if (settled) return
          emit({ type: 'progress', progress: { phase: 'connecting', file: remotePath, transferred: 0, total: 0, percent: 0 } })
          try {
            const outcome = await engine.upload(alias, tmp, remotePath, false, progress => emit({ type: 'progress', progress }))
            emit({ type: 'result', ok: true, transferredBytes: outcome.bytes })
          } catch (error) {
            emit({ type: 'result', ok: false, error: error instanceof Error ? error.message : String(error) })
          } finally {
            await unlink(tmp).catch(() => undefined)
            done()
          }
        })
      },
    },
    // ------------------------------------------------------- download
    {
      kind: 'exact',
      path: SSH_API.download,
      handler: async (req, res) => {
        if (!guard(req, res, 'GET')) return
        const url = new URL(req.url ?? '/', 'http://localhost')
        const alias = queryParam(url, 'alias')
        const remotePath = queryParam(url, 'remotePath')
        if (alias === undefined || remotePath === undefined) {
          writeJson(res, 400, { error: 'alias and remotePath query parameters are required' })
          return
        }
        const tmp = join(staging, `download-${randomBytes(6).toString('hex')}`)
        try {
          const outcome = await engine.download(alias, remotePath, tmp)
          res.writeHead(200, {
            'content-type': 'application/octet-stream',
            'content-length': String(outcome.bytes),
            'content-disposition': `attachment; filename="${basename(remotePath).replace(/"/g, '')}"`,
            'referrer-policy': 'no-referrer',
          })
          await new Promise<void>((resolve, reject) => {
            const source = createReadStream(tmp)
            source.on('error', reject)
            res.on('error', reject)
            source.pipe(res)
            source.on('end', resolve)
          })
        } catch (error) {
          if (!res.headersSent) {
            writeJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
          } else {
            // Mid-stream failure after headers: destroy so the browser does
            // not hang waiting for the promised content-length bytes.
            res.destroy()
          }
        } finally {
          await unlink(tmp).catch(() => undefined)
        }
      },
    },
  ]

  // ---------------------------------------------- terminal (upgrade)
  const upgrade: WebUpgradeRoute = {
    path: SSH_API.terminal,
    handler: (req, socket, head) => {
      if (!isLoopbackRequest(req)) {
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
        socket.destroy()
        return
      }
      const url = new URL(req.url ?? '/', 'http://localhost')
      const alias = queryParam(url, 'alias')
      if (alias === undefined) {
        socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n')
        socket.destroy()
        return
      }
      const cols = Number.parseInt(queryParam(url, 'cols') ?? '80', 10)
      const rows = Number.parseInt(queryParam(url, 'rows') ?? '24', 10)
      terminalWss.handleUpgrade(req, socket, head, (ws) => {
        let session: ShellSession | undefined
        let closed = false
        let paused = false
        // Resume the shell once the socket's send buffer drains below the
        // low-water mark (transport backpressure).
        const resume = (): void => {
          if (paused && ws.bufferedAmount < BACKPRESSURE_LOW_WATER) {
            paused = false
            session?.resume()
          }
        }
        const sendFrame = (frame: TerminalServerFrame): void => {
          if (closed || ws.readyState !== WebSocket.OPEN) return
          ws.send(JSON.stringify(frame), resume)
          if (!paused && ws.bufferedAmount > BACKPRESSURE_HIGH_WATER) {
            paused = true
            session?.pause()
          }
        }
        const closeSession = (): void => {
          const opened = session
          session = undefined
          if (opened !== undefined) opened.close()
        }
        engine.openShell(alias, {
          cols: Number.isFinite(cols) ? cols : 80,
          rows: Number.isFinite(rows) ? rows : 24,
        }).then((opened) => {
          if (ws.readyState !== WebSocket.OPEN) {
            opened.close()
            return
          }
          session = opened
          sendFrame({ type: 'ready', alias })
          opened.onData = (data) => sendFrame({ type: 'output', data: data.toString('utf8') })
          opened.onExit = (code, error) => {
            sendFrame({ type: 'exit', code, error })
            closed = true
            try { ws.close(1000) } catch { /* already closed */ }
          }
        }).catch((error) => {
          sendFrame({ type: 'exit', code: null, error: error instanceof Error ? error.message : String(error) })
          closed = true
          try { ws.close(1000) } catch { /* already closed */ }
        })
        ws.on('message', (data) => {
          let frame: TerminalClientFrame
          try {
            frame = JSON.parse(String(data)) as TerminalClientFrame
          } catch {
            return
          }
          if (frame.type === 'input') {
            session?.send(frame.data)
          } else if (frame.type === 'resize') {
            session?.resize(Math.max(2, frame.cols), Math.max(1, frame.rows))
          }
        })
        ws.on('close', () => {
          closed = true
          closeSession()
        })
        ws.on('error', () => {
          closed = true
          closeSession()
        })
      })
    },
  }

  return { routes, upgrade }
}
