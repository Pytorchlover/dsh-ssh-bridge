/**
 * The better-sidebar explorer bridge. dsh-better-sidebar's explorer (the
 * bottom panel's file tree / viewer / editor) lists the SESSION's cwd through
 * its own /sidebar/api/fs.* routes — local filesystem only. A patched
 * better-sidebar (scripts/patch-better-sidebar.mjs) consults the global this
 * module publishes before touching local disk: when the requested path lives
 * inside a remote-workspace marker directory, the answer comes from the SSH
 * engine (SFTP) instead, with paths kept in the marker's local namespace so
 * the explorer's navigation keeps working.
 *
 * The bridge returns null when the path is not remote — the patched handler
 * then falls back to its original local implementation untouched.
 */

import type { SshEngine } from './engine.ts'
import { resolveMarkerPath } from './workspace-marker.ts'

/** better-sidebar's fs entry shape (src/fs-tree.ts). */
interface SidebarFsEntry {
  name: string
  path: string
  isDir: boolean
  hidden: boolean
}

/** better-sidebar's fs.tree result shape. */
interface SidebarFsListing {
  path: string
  entries: SidebarFsEntry[]
  truncated: boolean
}

/** better-sidebar's fs.read result shape (text / binary variants). */
export type SidebarReadResult =
  | { kind: 'text'; content: string; truncated: boolean }
  | { kind: 'binary'; size: number; truncated: boolean; head: string }

/** The global handle the patched better-sidebar calls (null = not remote). */
export interface RemoteFsBridge {
  isRemote(path: string): boolean
  tree(payload: unknown): Promise<SidebarFsListing | null>
  read(payload: unknown): Promise<SidebarReadResult | null>
  write(payload: unknown): Promise<{ ok: true } | null>
}

/** The global name the patch looks up (kept in sync with the patch script). */
export const BRIDGE_GLOBAL = '__DSH_REMOTE_SSH_FS__'

/** One shared marker-local path join ('/' separators, as the explorer uses). */
function joinMarker(markerRootLocal: string, name: string): string {
  return markerRootLocal.endsWith('/') ? markerRootLocal + name : `${markerRootLocal}/${name}`
}

/** Extract the {sessionId?, cwd?, path?} payload shape better-sidebar sends. */
function payloadPaths(payload: unknown): { cwd?: string; path?: string } {
  if (typeof payload !== 'object' || payload === null) return {}
  const record = payload as { cwd?: unknown; path?: unknown }
  return {
    ...(typeof record.cwd === 'string' && record.cwd !== '' ? { cwd: record.cwd } : {}),
    ...(typeof record.path === 'string' && record.path !== '' ? { path: record.path } : {}),
  }
}

/**
 * Publish the bridge on globalThis. The patched better-sidebar (same host
 * process) reads it per call; unavailable global → patch is a no-op.
 * @returns disposer removing the global.
 */
export function publishSidebarBridge(engine: SshEngine): () => void {
  const target = globalThis as { [BRIDGE_GLOBAL]?: RemoteFsBridge }

  const bridge: RemoteFsBridge = {
    isRemote(path: string): boolean {
      return resolveMarkerPath(path) !== undefined
    },

    async tree(payload): Promise<SidebarFsListing | null> {
      const { cwd, path } = payloadPaths(payload)
      const resolved = resolveMarkerPath(path ?? cwd ?? '')
      if (resolved === undefined) return null
      const { marker, remotePath } = resolved
      const entries = await engine.ls(marker.alias, remotePath)
      const mapped: SidebarFsEntry[] = entries.map(entry => ({
        name: entry.name,
        path: joinMarker(marker.localRoot, entry.name),
        isDir: entry.type === 'dir',
        hidden: entry.name.startsWith('.'),
      }))
      // Directory-first, case-insensitive order (the explorer's convention).
      mapped.sort((a, b) => (a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })))
      return { path: path ?? cwd ?? marker.localRoot, entries: mapped, truncated: false }
    },

    async read(payload): Promise<SidebarReadResult | null> {
      const { path } = payloadPaths(payload)
      if (path === undefined) return null
      const resolved = resolveMarkerPath(path)
      if (resolved === undefined) return null
      const file = await engine.readFile(resolved.marker.alias, resolved.remotePath)
      if (file.binary) {
        return { kind: 'binary', size: file.bytes, truncated: file.truncated, head: '' }
      }
      return { kind: 'text', content: file.content, truncated: file.truncated }
    },

    async write(payload): Promise<{ ok: true } | null> {
      const record = typeof payload === 'object' && payload !== null ? payload as { path?: unknown; content?: unknown } : {}
      if (typeof record.path !== 'string' || typeof record.content !== 'string') return null
      const resolved = resolveMarkerPath(record.path)
      if (resolved === undefined) return null
      await engine.writeFile(resolved.marker.alias, resolved.remotePath, record.content)
      return { ok: true }
    },
  }

  target[BRIDGE_GLOBAL] = bridge
  return () => { delete target[BRIDGE_GLOBAL] }
}
