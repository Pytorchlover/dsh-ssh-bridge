/**
 * Remote session mode: bind a DSH session to a remote host directory, then
 * transparently execute the harness's built-in workspace tools ON that
 * remote — the ZCode "session lives on the server" experience.
 *
 * Mechanism: the `tools/execute` around-dispatch waterfall (official
 * @deepseek-ai/dsh-tools extension point). For a bound session, calls to
 * bash / read / write / edit / str_replace_editor / glob / grep /
 * read_image are satisfied by the SSH engine instead of the local machine;
 * every other tool (web, todo, subagent, skills…) passes through untouched.
 * The wrapper returns a value conforming to the ORIGINAL tool's output
 * schema, so the registry renders it with the tool's own presentation —
 * diffs, line numbers, glob cards all look native.
 *
 * Bindings survive host restarts (persisted in ~/.dsh/remote-ssh.json).
 */

import type { JsonValue, ToolDispatchExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import type { SshEngine } from './engine.ts'
import { withCwd, type ExecResult, type RemoteBinding } from './protocol.ts'

/** Cap on glob path results (mirrors the local tool's magnitude). */
const GLOB_CAP = 2000

/** Cap on grep matches returned to the model. */
const GREP_CAP = 500

/** Default foreground bash budget in remote mode (ms). */
const DEFAULT_BASH_TIMEOUT_MS = 120_000

/** Default read page size (lines), mirroring the local read tool. */
const READ_LIMIT_DEFAULT = 2000

// ---------------------------------------------------------------- bindings

/**
 * SessionId → remote workspace. In-memory map with persistence callbacks
 * owned by the host store (persisted in ~/.dsh/remote-ssh.json).
 */
export class RemoteBindings {
  private readonly bindings = new Map<string, RemoteBinding>()

  constructor(
    /** Persist the full map (called after every mutation). */
    private readonly persist: (bindings: Record<string, RemoteBinding>) => void,
    seed?: Record<string, RemoteBinding>,
  ) {
    if (seed !== undefined) {
      for (const [sessionId, binding] of Object.entries(seed)) {
        if (typeof binding?.alias === 'string' && typeof binding?.dir === 'string') {
          this.bindings.set(sessionId, { alias: binding.alias, dir: binding.dir })
        }
      }
    }
  }

  /** Bind (or rebind) one session to a remote directory. */
  bind(sessionId: string, alias: string, dir: string): RemoteBinding {
    const binding = { alias, dir }
    this.bindings.set(sessionId, binding)
    this.persist(this.snapshot())
    return binding
  }

  /** Remove one session's binding (no-op when absent). */
  unbind(sessionId: string): boolean {
    const removed = this.bindings.delete(sessionId)
    if (removed) this.persist(this.snapshot())
    return removed
  }

  /** One session's binding, when bound. */
  get(sessionId: string): RemoteBinding | undefined {
    return this.bindings.get(sessionId)
  }

  /** Every live binding (status surface). */
  list(): Array<{ sessionId: string } & RemoteBinding> {
    return [...this.bindings.entries()].map(([sessionId, binding]) => ({ sessionId, ...binding }))
  }

  private snapshot(): Record<string, RemoteBinding> {
    return Object.fromEntries(this.bindings.entries())
  }
}

/** A failure result the registry renders as the tool's error content. */
function errorResult(message: string): ToolExecutionResult {
  return {
    isError: true,
    error: { message },
    content: [{ type: 'text', text: message }],
  }
}

/**
 * A remote-satisfied success. The value is validated against the ORIGINAL
 * tool's output schema by the registry (createSuccessResult), which also
 * renders it with the tool's own output.render — so the cast only asserts
 * what that validation enforces.
 */
function successResult(value: unknown): ToolExecutionResult {
  // content is required by the result type; the registry regenerates it from
  // the original tool's output.render during normalization, so the empty
  // array here is only a type-level placeholder.
  return { isError: false, value: value as JsonValue, content: [] }
}

/** Resolve a tool-supplied path against the remote workspace. */
export function resolveRemotePath(binding: RemoteBinding, path: string | undefined): string {
  const raw = (path ?? '').trim()
  if (raw === '') return binding.dir
  if (raw.startsWith('/')) return raw
  const base = binding.dir.endsWith('/') ? binding.dir.slice(0, -1) : binding.dir
  return `${base}/${raw}`
}

/** Join a remote dir with a name (forward slashes only). */
function joinRemote(dir: string, name: string): string {
  const base = dir.endsWith('/') ? dir.slice(0, -1) : dir
  return `${base}/${name}`
}

/** POSIX single-quote escaping for remote command construction. */
function shQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`
}

/** Translate a glob pattern (with ** support) into a JS RegExp over `./rel` paths. */
function globToRegExp(pattern: string): RegExp {
  let source = ''
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i]
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        // '**' — swallow following slash to express "any depth"
        if (pattern[i + 2] === '/') { source += '(?:.*/)?'; i += 2 } else { source += '.*' ; i += 1 }
      } else {
        source += '[^/]*'
      }
    } else if (char === '?') {
      source += '[^/]'
    } else if ('\\^$.|+()[]{}'.includes(char)) {
      source += '\\' + char
    } else {
      source += char
    }
  }
  return new RegExp(`^\\./${source}$`)
}

/** Split text into lines (terminal newline ignored). */
function toLines(text: string): string[] {
  const body = text.endsWith('\n') ? text.slice(0, -1) : text
  return body === '' ? [] : body.split('\n')
}

// ---------------------------------------------------------------- dispatch

/** Loose argument shapes of the intercepted tools (model-supplied). */
interface BashArgs { command?: string; description?: string; timeoutMs?: number; workdir?: string; run_in_background?: boolean; sandbox_permissions?: string; justification?: string }
interface ReadArgs { file_path?: string; offset?: number; limit?: number }
interface WriteArgs { file_path?: string; content?: string }
interface EditArgs { file_path?: string; old_string?: string; new_string?: string; replace_all?: boolean }
interface EditorArgs { command?: string; path?: string; file_text?: string; old_str?: string; new_str?: string; insert_line?: number; view_range?: number[] }
interface GlobArgs { pattern?: string; path?: string }
interface GrepArgs { pattern?: string; path?: string; include?: string }

/** Read one remote file, split and paged like the local read tool. */
async function remoteRead(engine: SshEngine, binding: RemoteBinding, args: ReadArgs): Promise<unknown> {
  const path = resolveRemotePath(binding, args.file_path)
  const file = await engine.readFile(binding.alias, path)
  if (file.binary) throw new Error(`'${path}' looks like a binary file — the read tool is text-only`)
  const offset = typeof args.offset === 'number' && args.offset >= 1 ? Math.floor(args.offset) : 1
  const limit = typeof args.limit === 'number' && args.limit >= 1 ? Math.floor(args.limit) : READ_LIMIT_DEFAULT
  const all = toLines(file.content)
  const slice = all.slice(offset - 1, offset - 1 + limit)
  return {
    path,
    offset,
    lines: slice.map((text, index) => ({ number: offset + index, text })),
    totalLines: all.length,
  }
}

/** Write one remote file, reporting create/update like the local write tool. */
async function remoteWrite(engine: SshEngine, binding: RemoteBinding, args: WriteArgs): Promise<unknown> {
  if (typeof args.file_path !== 'string' || args.file_path === '') throw new Error('file_path is required')
  if (typeof args.content !== 'string') throw new Error('content is required')
  const path = resolveRemotePath(binding, args.file_path)
  let before: string | null = null
  try {
    const existing = await engine.readFile(binding.alias, path)
    before = existing.binary ? null : existing.content
  } catch { /* not created yet */ }
  await engine.writeFile(binding.alias, path, args.content)
  return { path, operation: before === null ? 'create' : 'update', before, after: args.content }
}

/** Apply a str_replace edit remotely (old_string unique unless replace_all). */
async function remoteEdit(engine: SshEngine, binding: RemoteBinding, args: EditArgs): Promise<unknown> {
  if (typeof args.file_path !== 'string' || args.file_path === '') throw new Error('file_path is required')
  if (typeof args.old_string !== 'string') throw new Error('old_string is required')
  if (typeof args.new_string !== 'string') throw new Error('new_string is required')
  const path = resolveRemotePath(binding, args.file_path)
  const file = await engine.readFile(binding.alias, path)
  if (file.binary) throw new Error(`'${path}' looks like a binary file — refusing to edit`)
  const before = file.content
  const first = before.indexOf(args.old_string)
  if (first < 0) throw new Error(`String to replace not found in ${path}`)
  if (args.replace_all !== true) {
    const second = before.indexOf(args.old_string, first + 1)
    if (second >= 0) throw new Error(`Found 2+ occurrences of the string in ${path} — make old_string unique or pass replace_all`)
  }
  const after = args.replace_all === true
    ? before.split(args.old_string).join(args.new_string)
    : before.slice(0, first) + args.new_string + before.slice(first + args.old_string.length)
  await engine.writeFile(binding.alias, path, after)
  return { path, before, after }
}

/** The command-shaped editor tool (view / create / str_replace / insert). */
async function remoteStrReplaceEditor(engine: SshEngine, binding: RemoteBinding, args: EditorArgs): Promise<string> {
  const path = resolveRemotePath(binding, args.path)
  switch (args.command) {
    case 'view': {
      const file = await engine.readFile(binding.alias, path)
      if (file.binary) return `[binary file ${path}, ${file.bytes} bytes]`
      const lines = toLines(file.content)
      const start = args.view_range !== undefined && args.view_range[0] >= 1 ? Math.floor(args.view_range[0]) : 1
      const end = args.view_range !== undefined && args.view_range[1] !== undefined && args.view_range[1] !== -1
        ? Math.min(Math.floor(args.view_range[1]), lines.length)
        : lines.length
      const body = lines.slice(start - 1, end).map((text, index) => `${start + index}→${text}`).join('\n')
      return `${path} (lines ${start}-${end} of ${lines.length}):\n${body}`
    }
    case 'create': {
      if (typeof args.file_text !== 'string') throw new Error('file_text is required for create')
      await engine.writeFile(binding.alias, path, args.file_text)
      return `File created successfully at: ${path}`
    }
    case 'str_replace': {
      if (typeof args.old_str !== 'string') throw new Error('old_str is required for str_replace')
      const value = await remoteEdit(engine, binding, { file_path: path, old_string: args.old_str, new_string: args.new_str ?? '' })
      const edit = value as { before: string; after: string }
      return `The file ${path} has been edited (${edit.before.length} → ${edit.after.length} chars).`
    }
    case 'insert': {
      if (typeof args.insert_line !== 'number') throw new Error('insert_line is required for insert')
      if (typeof args.new_str !== 'string') throw new Error('new_str is required for insert')
      const file = await engine.readFile(binding.alias, path)
      if (file.binary) throw new Error(`'${path}' looks like a binary file — refusing to edit`)
      const lines = toLines(file.content)
      const at = Math.min(Math.max(Math.floor(args.insert_line), 0), lines.length)
      lines.splice(at, 0, ...toLines(args.new_str))
      await engine.writeFile(binding.alias, path, lines.join('\n') + (file.content.endsWith('\n') || lines.length === 0 ? '\n' : ''))
      return `Inserted after line ${at} of ${path}.`
    }
    default:
      throw new Error(`unsupported str_replace_editor command: ${String(args.command)}`)
  }
}

/** Glob via one `find` on the remote, filtered in JS. */
async function remoteGlob(engine: SshEngine, binding: RemoteBinding, args: GlobArgs): Promise<unknown> {
  if (typeof args.pattern !== 'string' || args.pattern === '') throw new Error('pattern is required')
  const root = resolveRemotePath(binding, args.path ?? '.')
  const result = await engine.exec(binding.alias, `cd -- ${shQuote(root)} && find . -type f`, 30_000)
  if (!result.success) throw new Error(`glob failed: ${result.stderr || result.error || `exit code ${result.exitCode}`}`)
  const matcher = globToRegExp(args.pattern)
  const paths: string[] = []
  for (const line of toLines(result.stdout)) {
    if (!matcher.test(line)) continue
    paths.push(joinRemote(root, line.slice(2)))
    if (paths.length >= GLOB_CAP) break
  }
  return { root, paths }
}

/** Grep via ripgrep when the host has it, recursive ERE grep otherwise. */
async function remoteGrep(engine: SshEngine, binding: RemoteBinding, args: GrepArgs): Promise<unknown> {
  if (typeof args.pattern !== 'string' || args.pattern === '') throw new Error('pattern is required')
  const root = resolveRemotePath(binding, args.path ?? '.')
  const include = typeof args.include === 'string' && args.include !== '' ? ` --include=${shQuote(args.include)}` : ''
  // Prefer ripgrep (an order of magnitude faster on large repos, gitignore-
  // aware); fall back to POSIX grep on hosts without it. Both emit
  // path:line:content lines relative to the root.
  const hasRg = await engine.hasCmd(binding.alias, 'rg')
  const command = hasRg
    ? `cd -- ${shQuote(root)} && rg -n --no-heading --hidden -g '!/.git/'${include ? ` -g ${shQuote(args.include!)}` : ''} -- ${shQuote(args.pattern)} . 2>/dev/null`
    : `cd -- ${shQuote(root)} && grep -rnIE${include} -- ${shQuote(args.pattern)} . 2>/dev/null`
  const result = await engine.exec(binding.alias, command, 60_000)
  if (!result.success && result.exitCode !== 1) {
    throw new Error(`grep failed: ${result.stderr || result.error || `exit code ${result.exitCode}`}`)
  }
  const matches: Array<{ path: string; lineNumber: number; line: string }> = []
  for (const line of toLines(result.stdout)) {
    const parsed = /^(.*?):(\d+):(.*)$/.exec(line)
    if (parsed === null) continue
    const rel = parsed[1].startsWith('./') ? parsed[1].slice(2) : parsed[1]
    matches.push({ path: joinRemote(root, rel), lineNumber: Number.parseInt(parsed[2], 10), line: parsed[3] })
    if (matches.length >= GREP_CAP) break
  }
  return { matches }
}

/** Bash forwarding: one remote exec in the session's remote workspace. */
async function remoteBash(engine: SshEngine, binding: RemoteBinding, args: BashArgs): Promise<unknown> {
  if (typeof args.command !== 'string' || args.command === '') throw new Error('command is required')
  if (args.run_in_background === true) {
    throw new Error('远程会话暂不支持 run_in_background，请直接前台执行（可加 timeoutMs）')
  }
  if (args.sandbox_permissions !== undefined) {
    throw new Error('远程会话没有本地沙箱分级，无需 sandbox_permissions')
  }
  const timeoutMs = typeof args.timeoutMs === 'number' && args.timeoutMs > 0 ? args.timeoutMs : DEFAULT_BASH_TIMEOUT_MS
  // The command runs inside the session's remote workspace (or the call's
  // own workdir, resolved against it) — the same contract as local bash.
  const cwd = resolveRemotePath(binding, args.workdir)
  return await engine.exec(binding.alias, withCwd(args.command, cwd), timeoutMs)
}

/** Map an exec outcome onto the FOREGROUND bash value (dsh-tool-bash). */
function bashObjectValue(result: ExecResult, timeoutMs: number): unknown {
  return {
    kind: 'foreground',
    exitCode: result.exitCode,
    signal: null,
    timedOut: result.timedOut,
    aborted: false,
    timeoutMs,
    stdout: { text: result.stdout, truncated: false },
    stderr: { text: result.stderr, truncated: false },
  }
}

/**
 * Map an exec outcome onto the STRING value dsh-tool-bash-persistent
 * returns (its output schema is `{type: "string"}` — captured terminal
 * text, with a timeout notice).
 */
function bashStringValue(result: ExecResult, timeoutMs: number): string {
  if (result.timedOut) {
    return `Your command timed out after ${Math.round(timeoutMs / 1000)} seconds.\n${result.stdout}${result.stderr}`
  }
  const parts: string[] = []
  if (result.stdout !== '') parts.push(result.stdout.replace(/\n$/, ''))
  if (result.stderr !== '') parts.push(result.stderr.replace(/\n$/, ''))
  if (parts.length === 0) return ''
  if (result.exitCode !== 0 && result.exitCode !== null) parts.push(`(exit code ${result.exitCode})`)
  return parts.join('\n')
}

/** Does this tool's output schema want a bare string (persistent bash)? */
function wantsStringValue(definition: ToolLikeDefinition | undefined): boolean {
  const schema = definition?.output?.schema as { type?: string } | undefined
  return schema?.type === 'string'
}

/** The minimal tool-definition face the dispatcher needs. */
export interface ToolLikeDefinition {
  output?: { schema?: unknown }
}

// ---------------------------------------------------------------- listener

/**
 * Build the `tools/execute` around-dispatch listener implementing remote
 * session mode. A session is remote when it has an explicit binding OR its
 * cwd lives inside a remote-workspace marker directory (sessions created in
 * a remote workspace are remote automatically). Unbound sessions and
 * non-intercepted tools pass through.
 */
export function makeRemoteSessionListener(
  engine: SshEngine,
  bindings: RemoteBindings,
  resolveByCwd?: (cwd: string) => RemoteBinding | undefined,
  /** Registry lookup so the bash value matches the REGISTERED variant's schema. */
  getTool?: (name: string, agent: unknown) => ToolLikeDefinition | undefined,
) {
  return async (exec: ToolDispatchExecution, next: () => Promise<ToolExecutionResult>): Promise<ToolExecutionResult> => {
    const agent = exec.agent as { id?: string; session?: { header?: { cwd?: string } } } | undefined
    const sessionId = agent?.id
    if (sessionId === undefined) return await next()
    const binding = bindings.get(sessionId) ?? ((): RemoteBinding | undefined => {
      const cwd = agent?.session?.header?.cwd
      if (cwd === undefined || resolveByCwd === undefined) return undefined
      return resolveByCwd(cwd)
    })()
    if (binding === undefined) return await next()
    if (exec.signal.aborted) return await next()
    try {
      switch (exec.name) {
        case 'bash': {
          const result = await remoteBash(engine, binding, exec.arguments as BashArgs) as ExecResult
          const timeoutMs = typeof (exec.arguments as BashArgs).timeoutMs === 'number' && (exec.arguments as BashArgs).timeoutMs! > 0
            ? (exec.arguments as BashArgs).timeoutMs!
            : DEFAULT_BASH_TIMEOUT_MS
          // Two bash variants ship in dsh-base: dsh-tool-bash (structured
          // foreground/background value) and dsh-tool-bash-persistent
          // (bare string). Match whichever this scope actually registered.
          const value = wantsStringValue(getTool?.('bash', exec.agent))
            ? bashStringValue(result, timeoutMs)
            : bashObjectValue(result, timeoutMs)
          return successResult(value)
        }
        case 'read':
          return successResult(await remoteRead(engine, binding, exec.arguments as ReadArgs))
        case 'write':
          return successResult(await remoteWrite(engine, binding, exec.arguments as WriteArgs))
        case 'edit':
          return successResult(await remoteEdit(engine, binding, exec.arguments as EditArgs))
        case 'str_replace_editor':
          return successResult(await remoteStrReplaceEditor(engine, binding, exec.arguments as EditorArgs))
        case 'glob':
          return successResult(await remoteGlob(engine, binding, exec.arguments as GlobArgs))
        case 'grep':
          return successResult(await remoteGrep(engine, binding, exec.arguments as GrepArgs))
        case 'read_image':
          return errorResult(`远程会话（${binding.alias}:${binding.dir}）暂不支持 read_image，请用 read 读取文本`)
        default:
          return await next()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return errorResult(`[remote ${binding.alias}] ${message}`)
    }
  }
}
