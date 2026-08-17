/**
 * Remote-workspace markers: a remote host directory is represented on the
 * DSH host as a local marker directory under ~/.dsh/remote-ssh/ws/ carrying a
 * marker.json ({alias, dir}). The marker directory is registered as a normal
 * DSH workspace (renamed to "alias · dir"), so:
 *   - the sidebar shows it like any workspace and sessions group inside it;
 *   - a session created there has cwd = the marker directory, which the
 *     tools/execute bridge resolves back to the remote (alias, dir) —
 *     no manual binding step;
 *   - the better-sidebar explorer bridge serves the REMOTE tree for any
 *     path under the marker directory (nested paths map onto remote
 *     subdirectories).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { RemoteBinding } from './protocol.ts'

/** Marker file name inside every marker workspace root. */
const MARKER_FILE = 'marker.json'

/** The marker root: <home>/.dsh/remote-ssh/ws. */
export function markerRoot(): string {
  return join(homedir(), '.dsh', 'remote-ssh', 'ws')
}

/** One parsed marker. */
export interface Marker extends RemoteBinding {
  /** The local marker directory (the DSH workspace path). */
  localRoot: string
}

/** Slugify a remote directory into a filesystem-safe segment. */
function slugifyDir(dir: string): string {
  const slug = dir.split('/').filter(part => part !== '').map(part =>
    part.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'root',
  ).join('_')
  return (slug === '' ? 'root' : slug).slice(0, 80)
}

/**
 * Create (or reuse) the marker directory for one remote workspace.
 * @returns the local marker directory path.
 */
export function createMarkerWorkspace(alias: string, dir: string): string {
  const root = markerRoot()
  const path = join(root, `${alias}_${slugifyDir(dir)}`)
  mkdirSync(path, { recursive: true, mode: 0o700 })
  writeFileSync(join(path, MARKER_FILE), JSON.stringify({ version: 1, alias, dir }, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 })
  return path
}

/** In-memory marker cache (marker files change only through this module). */
const cache = new Map<string, Marker>()

/** Load the marker of one marker-workspace segment (cached). */
function loadMarker(localRoot: string): Marker | undefined {
  const cached = cache.get(localRoot)
  if (cached !== undefined) return cached
  const file = join(localRoot, MARKER_FILE)
  if (!existsSync(file)) return undefined
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { alias?: unknown; dir?: unknown }
    if (typeof parsed.alias !== 'string' || typeof parsed.dir !== 'string') return undefined
    const marker: Marker = { alias: parsed.alias, dir: parsed.dir, localRoot }
    cache.set(localRoot, marker)
    return marker
  } catch {
    return undefined
  }
}

/** Every existing marker (status surface). */
export function listMarkers(): Marker[] {
  const root = markerRoot()
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => loadMarker(join(root, entry.name)))
    .filter((marker): marker is Marker => marker !== undefined)
}

/**
 * Resolve a local path against the marker tree.
 * @returns the marker plus the REMOTE path this local path denotes, or
 * undefined when the path is not under any marker workspace.
 */
export function resolveMarkerPath(path: string): { marker: Marker; remotePath: string } | undefined {
  if (typeof path !== 'string' || path === '') return undefined
  const root = markerRoot()
  if (path !== root && !path.startsWith(root + '/')) return undefined
  // path = root/<segment>[/nested/...]
  const rest = path === root ? '' : path.slice(root.length + 1)
  if (rest === '') return undefined
  const [segment, ...nested] = rest.split('/')
  const localRoot = join(root, segment)
  const marker = loadMarker(localRoot)
  if (marker === undefined) return undefined
  const rel = nested.filter(part => part !== '').join('/')
  const remotePath = rel === '' ? marker.dir : `${marker.dir.replace(/\/$/, '')}/${rel}`
  return { marker, remotePath }
}

/** Is this local path inside a remote-workspace marker? */
export function isMarkerPath(path: string): boolean {
  return resolveMarkerPath(path) !== undefined
}
