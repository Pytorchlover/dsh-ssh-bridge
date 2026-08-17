/**
 * Host config store: one JSON file (`~/.dsh/remote-ssh.json`) holding every
 * SSH host entry plus the recent remote workspaces, written atomically
 * (tmp + rename). Also parses the user's standard `~/.ssh/config` — both for
 * the form's alias auto-fill (read-only) and for one-shot import.
 *
 * SECURITY: this file never contains secret material. Passwords and key
 * passphrases live in DSH's official credential store (ctx.credentials →
 * `~/.dsh/.credentials.yaml`, owner-only) and are resolved per connect.
 *
 * LEGACY: the marketplace dsh-ssh plugin kept its hosts in
 * `~/.dsh/dsh-ssh.json` (with inline plaintext secrets in old versions).
 * `extractLegacyStore()` lifts those entries — and their inline secrets —
 * into this store once, so switching plugins loses nothing.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { HostPayload, ImportResult, RecentWorkspace, RemoteBinding, SshConfigAlias, SshHostEntry, SshHostSummary } from './protocol.ts'

/** File format version. */
const FORMAT_VERSION = 1

interface StoreFile {
  version: number
  hosts: SshHostEntry[]
  recents: RecentWorkspace[]
  /** Remote-session bindings (sessionId → remote workspace), persisted. */
  bindings?: Record<string, RemoteBinding>
  /** One-shot journal: legacy dsh-ssh.json already lifted (aliases recorded). */
  migrated?: string[]
}

/** Cap on remembered recent workspaces. */
const RECENTS_CAP = 20

/** Store file location: <home>/.dsh/remote-ssh.json. */
export function storePath(): string {
  return join(homedir(), '.dsh', 'remote-ssh.json')
}

/** The legacy marketplace plugin's store location. */
export function legacyStorePath(): string {
  return join(homedir(), '.dsh', 'dsh-ssh.json')
}

/** The user's standard OpenSSH config path. */
export function sshConfigPath(): string {
  return join(homedir(), '.ssh', 'config')
}

interface StoreFile {
  version: number
  hosts: SshHostEntry[]
  recents: RecentWorkspace[]
  /** One-shot journal: legacy dsh-ssh.json already lifted (aliases recorded). */
  migrated?: string[]
}

/** Validate the wire shape of a host payload; returns a message or undefined. */
export function validateHostPayload(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return 'body must be a JSON object'
  const p = payload as Record<string, unknown>
  if (typeof p.host !== 'string' || p.host.trim() === '') return 'host is required'
  if (typeof p.user !== 'string' || p.user.trim() === '') return 'user is required'
  const auth = p.auth as Record<string, unknown> | undefined
  if (auth !== undefined) {
    if (typeof auth !== 'object' || auth === null) return 'auth must be an object'
    if (auth.kind !== 'key' && auth.kind !== 'password') return 'auth.kind must be key or password'
    if (auth.kind === 'key' && (typeof auth.keyPath !== 'string' || auth.keyPath.trim() === '')) {
      return 'auth.keyPath is required for key auth'
    }
    if (auth.kind === 'password' && auth.password !== undefined && typeof auth.password !== 'string') {
      return 'auth.password must be a string when provided'
    }
  }
  if (p.port !== undefined && (typeof p.port !== 'number' || !Number.isInteger(p.port) || p.port < 1 || p.port > 65535)) {
    return 'port must be an integer in 1..65535'
  }
  if (p.proxyJump !== undefined && (!Array.isArray(p.proxyJump) || p.proxyJump.some(x => typeof x !== 'string' || x === ''))) {
    return 'proxyJump must be an array of alias strings'
  }
  if (p.workspace !== undefined && typeof p.workspace !== 'string') return 'workspace must be a string'
  return undefined
}

/** Alias grammar: letters/digits plus dots, hyphens, underscores (IP/domain aliases included). */
const ALIAS_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

/** Validate an alias for creation. */
export function validateAlias(alias: string): string | undefined {
  if (!ALIAS_RE.test(alias)) return 'alias must be letters, digits, dots, hyphens or underscores'
  return undefined
}

/** One parsed ~/.ssh/config Host block. */
interface SshConfigBlock {
  pattern: string
  props: Record<string, string>
}

/** Parse ~/.ssh/config into blocks (empty when the file is absent). */
function parseSshConfig(configPath: string): SshConfigBlock[] {
  if (!existsSync(configPath)) return []
  const blocks: SshConfigBlock[] = []
  let current: SshConfigBlock | undefined
  for (const raw of readFileSync(configPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue
    const match = /^([A-Za-z0-9_\-]+)\s+(.+)$/.exec(line)
    if (match === null) continue
    const key = match[1].toLowerCase()
    const value = match[2].trim()
    if (key === 'host') {
      current = { pattern: value, props: {} }
      blocks.push(current)
    } else if (current !== undefined) {
      current.props[key] = value
    }
  }
  return blocks
}

/**
 * The host store. Pure file I/O — no cordis dependency, unit-testable.
 */
export class HostStore {
  /** The JSON file path. */
  readonly path: string
  /** Optional overrides for tests. */
  private readonly sshConfigOverride: string | undefined
  private readonly legacyOverride: string | undefined

  /**
   * @param path - store file path (defaults to the standard location).
   * @param overrides - ssh config / legacy store path overrides (tests only).
   */
  constructor(path?: string, overrides?: { sshConfig?: string; legacy?: string }) {
    this.path = resolve(path ?? storePath())
    this.sshConfigOverride = overrides?.sshConfig
    this.legacyOverride = overrides?.legacy
  }

  /** Load all entries (empty store when the file is absent). */
  list(): SshHostEntry[] {
    return this.load().hosts
  }

  /** Find one entry by alias. */
  find(alias: string): SshHostEntry | undefined {
    return this.list().find(entry => entry.alias === alias)
  }

  /** Secret-free projection for the browser and agent surfaces. */
  summarize(entry: SshHostEntry): SshHostSummary {
    let keyReady = true
    if (entry.auth.kind === 'key' && entry.auth.keyPath) {
      keyReady = existsSync(expandHome(entry.auth.keyPath))
    }
    return {
      alias: entry.alias,
      host: entry.host,
      port: entry.port,
      user: entry.user,
      auth: entry.auth.kind,
      ...(entry.auth.kind === 'key' && entry.auth.keyPath ? { keyPath: entry.auth.keyPath } : {}),
      keyReady,
      proxyJump: [...entry.proxyJump],
      // Credential-configuration flags (never the secret values).
      passwordConfigured: entry.auth.kind === 'password' && entry.auth.passwordConfigured === true,
      passphraseConfigured: entry.auth.kind === 'key' && entry.auth.passphraseConfigured === true,
      // Optional fields are spread conditionally: the tool bridge rejects
      // undefined-valued properties as non-lossless JSON.
      ...(entry.workspace !== undefined && entry.workspace !== '' ? { workspace: entry.workspace } : {}),
      ...(entry.description !== undefined ? { description: entry.description } : {}),
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }
  }

  /** Create one entry. Throws on alias collision or invalid payload. */
  create(payload: HostPayload): SshHostEntry {
    const alias = payload.alias?.trim()
    if (!alias) throw new Error('alias is required')
    const aliasError = validateAlias(alias)
    if (aliasError !== undefined) throw new Error(aliasError)
    const bodyError = validateHostPayload(payload)
    if (bodyError !== undefined) throw new Error(bodyError)
    if (payload.auth === undefined) throw new Error('auth is required')
    const file = this.load()
    if (file.hosts.some(entry => entry.alias === alias)) throw new Error(`alias '${alias}' already exists`)
    const now = Date.now()
    const entry: SshHostEntry = {
      alias,
      host: payload.host.trim(),
      port: payload.port ?? 22,
      user: payload.user.trim(),
      auth: {
        kind: payload.auth.kind,
        keyPath: payload.auth.kind === 'key' ? expandHome(payload.auth.keyPath?.trim() ?? '') : undefined,
        // Only configuration state is persisted — the secret VALUES live in
        // the DSH credential store (vault), keyed by the alias. A non-empty
        // incoming secret marks the vault as configured.
        passwordConfigured: payload.auth.kind === 'password' && hasValue(payload.auth.password),
        passphraseConfigured: payload.auth.kind === 'key' && hasValue(payload.auth.passphrase),
      },
      workspace: payload.workspace?.trim() || undefined,
      proxyJump: [...(payload.proxyJump ?? [])],
      description: payload.description?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    }
    file.hosts.push(entry)
    this.save(file)
    return entry
  }

  /** Update the fields present in `patch`; unknown aliases throw. */
  update(alias: string, patch: Partial<HostPayload>): SshHostEntry {
    const file = this.load()
    const entry = file.hosts.find(candidate => candidate.alias === alias)
    if (entry === undefined) throw new Error(`alias '${alias}' not found`)
    const bodyError = validateHostPayload({ host: patch.host ?? entry.host, user: patch.user ?? entry.user, ...patch })
    if (bodyError !== undefined) throw new Error(bodyError)
    if (patch.host !== undefined) entry.host = patch.host.trim()
    if (patch.port !== undefined) entry.port = patch.port
    if (patch.user !== undefined) entry.user = patch.user.trim()
    if (patch.workspace !== undefined) entry.workspace = patch.workspace.trim() || undefined
    if (patch.auth !== undefined) {
      const auth = patch.auth
      // A changed key path with no passphrase means the new key has none;
      // only keep the old configured flag when the key path is unchanged.
      const keyChanged = auth.kind === 'key'
        && auth.keyPath !== undefined
        && expandHome(auth.keyPath.trim()) !== entry.auth.keyPath
      const keepPassphrase = auth.kind === 'key'
        && auth.passphrase === undefined
        && !keyChanged
        && entry.auth.passphraseConfigured === true
      entry.auth = {
        kind: auth.kind,
        keyPath: auth.kind === 'key' ? expandHome(auth.keyPath?.trim() ?? '') : undefined,
        passwordConfigured: auth.kind === 'password' ? hasValue(auth.password) || (auth.password === undefined && entry.auth.passwordConfigured === true && auth.kind === entry.auth.kind) : undefined,
        passphraseConfigured: auth.kind === 'key' ? (keepPassphrase || hasValue(auth.passphrase)) : undefined,
      }
    }
    if (patch.proxyJump !== undefined) entry.proxyJump = [...patch.proxyJump]
    if (patch.description !== undefined) entry.description = patch.description.trim() || undefined
    entry.updatedAt = Date.now()
    this.save(file)
    return entry
  }

  /** Remove one entry. */
  delete(alias: string): void {
    const file = this.load()
    const index = file.hosts.findIndex(candidate => candidate.alias === alias)
    if (index < 0) throw new Error(`alias '${alias}' not found`)
    file.hosts.splice(index, 1)
    file.recents = file.recents.filter(recent => recent.alias !== alias)
    this.save(file)
  }

  // ------------------------------------------------------------ recents

  /** Remember a workspace opening (ZCode-style recent list, newest first). */
  addRecent(alias: string, dir: string): void {
    if (dir.trim() === '') return
    const file = this.load()
    file.recents = file.recents.filter(recent => !(recent.alias === alias && recent.dir === dir))
    file.recents.unshift({ alias, dir, at: Date.now() })
    if (file.recents.length > RECENTS_CAP) file.recents.length = RECENTS_CAP
    this.save(file)
  }

  /** The recent workspace list (newest first). */
  listRecents(): RecentWorkspace[] {
    return [...this.load().recents]
  }

  // ---------------------------------------------------------- bindings

  /** The persisted remote-session bindings (sessionId → remote workspace). */
  loadBindings(): Record<string, RemoteBinding> {
    return this.load().bindings ?? {}
  }

  /** Persist the remote-session bindings map. */
  saveBindings(bindings: Record<string, RemoteBinding>): void {
    const file = this.load()
    file.bindings = bindings
    this.save(file)
  }

  // ------------------------------------------------------- ssh config

  /**
   * Read ~/.ssh/config Host blocks for the form's alias auto-fill — a pure
   * read, nothing is created. Non-wildcard blocks with a HostName qualify.
   */
  listSshConfigAliases(): SshConfigAlias[] {
    const blocks = parseSshConfig(this.sshConfigOverride ?? sshConfigPath())
    const aliases: SshConfigAlias[] = []
    for (const block of blocks) {
      const pattern = block.pattern.split(/\s+/)[0]
      if (pattern.includes('*') || pattern.includes('?')) continue
      const hostName = block.props.hostname
      if (hostName === undefined || hostName === '') continue
      aliases.push({
        alias: pattern,
        host: hostName,
        port: block.props.port !== undefined ? Number.parseInt(block.props.port, 10) || 22 : 22,
        ...(block.props.user !== undefined ? { user: block.props.user } : {}),
        ...(block.props.identityfile !== undefined ? { identityFile: block.props.identityfile } : {}),
        ...(block.props.proxyjump !== undefined ? { proxyJump: block.props.proxyjump } : {}),
      })
    }
    return aliases
  }

  /**
   * Import hosts from `~/.ssh/config`: Host blocks with a single non-wildcard
   * pattern and a HostName become entries (key auth via IdentityFile, jump
   * hosts via ProxyJump). Existing aliases are skipped.
   * @returns import statistics.
   */
  importFromSshConfig(): ImportResult {
    const blocks = parseSshConfig(this.sshConfigOverride ?? sshConfigPath())
    const skippedNames = new Set<string>()
    let added = 0
    for (const block of blocks) {
      const pattern = block.pattern.split(/\s+/)[0]
      if (pattern.includes('*') || pattern.includes('?')) {
        skippedNames.add(pattern)
        continue
      }
      const hostName = block.props.hostname
      if (hostName === undefined || hostName === '') {
        skippedNames.add(pattern)
        continue
      }
      if (this.list().some(entry => entry.alias === pattern)) {
        skippedNames.add(pattern)
        continue
      }
      const payload: HostPayload = {
        alias: pattern,
        host: hostName,
        port: block.props.port !== undefined ? Number.parseInt(block.props.port, 10) || 22 : 22,
        user: block.props.user ?? process.env.USER ?? 'root',
        auth: {
          kind: block.props.identityfile !== undefined ? 'key' : 'password',
          keyPath: block.props.identityfile,
          // No inlined secret is ever imported: vault storage is the only
          // sanctioned home for one. A password-auth host imported with no
          // logged-in secret comes back as "not configured" until the user
          // sets it in the GUI.
        },
        proxyJump: block.props.proxyjump !== undefined
          ? block.props.proxyjump.split(',').map(hop => hop.trim()).filter(hop => hop !== '')
          : [],
        description: 'imported from ~/.ssh/config',
      }
      try {
        this.create(payload)
        added += 1
      } catch {
        // Unusable entry (bad alias grammar etc.) — count as skipped.
        skippedNames.add(pattern)
      }
    }
    return { parsed: blocks.length, added, skipped: skippedNames.size, skippedNames: [...skippedNames] }
  }

  // ------------------------------------------------------------ legacy

  /**
   * Lift the marketplace dsh-ssh plugin's store (`~/.dsh/dsh-ssh.json`) into
   * this store once: every host whose alias does not already exist here is
   * created (including its inline plaintext secret, returned so the caller
   * can move it into the credential vault — this store never persists it).
   * The journal (`migrated`) keeps the operation idempotent.
   * @returns the lifted aliases with any inline secrets found.
   */
  extractLegacyStore(): Array<{ alias: string; password?: string; passphrase?: string }> {
    const file = this.load()
    const legacyPath = this.legacyOverride ?? legacyStorePath()
    if (!existsSync(legacyPath)) return []
    let legacy: { hosts?: unknown[] }
    try {
      legacy = JSON.parse(readFileSync(legacyPath, 'utf8')) as { hosts?: unknown[] }
    } catch {
      return []
    }
    if (!Array.isArray(legacy.hosts)) return []
    const lifted: Array<{ alias: string; password?: string; passphrase?: string }> = []
    for (const raw of legacy.hosts) {
      if (typeof raw !== 'object' || raw === null) continue
      const entry = raw as Record<string, unknown>
      const alias = typeof entry.alias === 'string' ? entry.alias : ''
      if (alias === '' || !ALIAS_RE.test(alias)) continue
      if (this.find(alias) !== undefined || (file.migrated ?? []).includes(alias)) continue
      const auth = typeof entry.auth === 'object' && entry.auth !== null ? entry.auth as Record<string, unknown> : {}
      const kind = auth.kind === 'key' ? 'key' : 'password'
      const password = typeof auth.password === 'string' && auth.password !== '' ? auth.password : undefined
      const passphrase = typeof auth.passphrase === 'string' && auth.passphrase !== '' ? auth.passphrase : undefined
      try {
        this.create({
          alias,
          host: typeof entry.host === 'string' ? entry.host : '',
          port: typeof entry.port === 'number' ? entry.port : 22,
          user: typeof entry.user === 'string' ? entry.user : 'root',
          auth: {
            kind,
            keyPath: typeof auth.keyPath === 'string' ? auth.keyPath : undefined,
            password,
            passphrase,
          },
          workspace: typeof entry.workspace === 'string' ? entry.workspace : undefined,
          proxyJump: Array.isArray(entry.proxyJump) ? entry.proxyJump.filter((x): x is string => typeof x === 'string') : [],
          description: typeof entry.description === 'string' ? entry.description : undefined,
        })
        lifted.push({ alias, ...(password !== undefined ? { password } : {}), ...(passphrase !== undefined ? { passphrase } : {}) })
        file.migrated = [...(file.migrated ?? []), alias]
      } catch {
        // Unusable legacy entry — leave it in the old file.
      }
    }
    if (lifted.length > 0) {
      const current = this.load()
      current.migrated = file.migrated
      this.save(current)
    }
    return lifted
  }

  // ------------------------------------------------------------ private

  private load(): StoreFile {
    if (!existsSync(this.path)) return { version: FORMAT_VERSION, hosts: [], recents: [] }
    try {
      const parsed = JSON.parse(readFileSync(this.path, 'utf8')) as StoreFile
      if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.hosts)) {
        throw new Error('store file shape invalid')
      }
      return { ...parsed, recents: Array.isArray(parsed.recents) ? parsed.recents : [] }
    } catch {
      // A corrupt store must not brick the plugin — and must not be silently
      // overwritten by the next save: rename it aside for manual recovery
      // (the plugin then starts from an empty list).
      try {
        renameSync(this.path, `${this.path}.corrupt-${Date.now()}`)
      } catch { /* best effort */ }
      return { version: FORMAT_VERSION, hosts: [], recents: [] }
    }
  }

  private save(file: StoreFile): void {
    const dir = dirname(this.path)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 })
    const tmp = this.path + '.tmp'
    // Hard guarantee: never write secret material to disk. Even if an entry
    // in memory still carried a legacy inline secret, it is dropped here.
    const serialized = file.hosts.map(entry => ({
      ...entry,
      auth: {
        kind: entry.auth.kind,
        keyPath: entry.auth.keyPath,
        passwordConfigured: entry.auth.passwordConfigured === true,
        passphraseConfigured: entry.auth.passphraseConfigured === true,
      },
    }))
    writeFileSync(tmp, JSON.stringify({ ...file, hosts: serialized }, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
    renameSync(tmp, this.path)
  }
}

/** A non-empty string counts as a configured secret. */
export function hasValue(value: string | undefined): boolean {
  return typeof value === 'string' && value !== ''
}

/** Expand a leading `~` in a filesystem path. */
export function expandHome(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/')) return join(homedir(), path.slice(2))
  return path
}
