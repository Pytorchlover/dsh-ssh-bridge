#!/usr/bin/env node
/**
 * Patch the installed dsh-better-sidebar so its explorer serves REMOTE files
 * for dsh-remote-ssh workspaces (sessions whose cwd is a remote-workspace
 * marker directory).
 *
 * What it does (idempotent; --revert restores backups):
 *   1. drops src/remote-bridge.ts into the package;
 *   2. wraps buildApi's returned API record: the fs.tree / fs.read /
 *      fs.write handlers first consult the global bridge published by the
 *      dsh-remote-ssh host plugin (same process). Marker paths are answered
 *      from the SSH engine; everything else falls back to the original
 *      local-filesystem behavior untouched.
 *
 * Re-run this after updating/reinstalling dsh-better-sidebar.
 *
 * Usage:
 *   node scripts/patch-better-sidebar.mjs [package-dir] [--revert]
 */

import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const revert = args.includes('--revert')
const pkgDir = resolve(args.find(a => !a.startsWith('--')) ?? join(process.env.HOME ?? '~', '.dsh', 'profiles', 'web', 'node_modules', 'dsh-better-sidebar'))

const INDEX = join(pkgDir, 'src', 'index.ts')
const BRIDGE = join(pkgDir, 'src', 'remote-bridge.ts')
const MARK = '// dsh-remote-ssh bridge patch'

const BRIDGE_SOURCE = `/**
 * ${MARK}
 * Wraps the sidebar API record: fs.tree / fs.read / fs.write consult the
 * global published by the dsh-remote-ssh host plugin PER CALL (load order is
 * unspecified); remote-marker paths are served over SSH, everything else
 * falls back to local fs.
 */
type SidebarApiRecord = Record<string, (payload: unknown, ...rest: unknown[]) => unknown>

export function withRemoteFsBridge(api: SidebarApiRecord): SidebarApiRecord {
  const wrap = (key: 'fs.tree' | 'fs.read' | 'fs.write', method: 'tree' | 'read' | 'write'): void => {
    const original = api[key]
    if (typeof original !== 'function') return
    api[key] = async (payload: unknown, ...rest: unknown[]) => {
      const bridge = (globalThis as {
        __DSH_REMOTE_SSH_FS__?: {
          tree(payload: unknown): Promise<unknown>
          read(payload: unknown): Promise<unknown>
          write(payload: unknown): Promise<unknown>
        }
      }).__DSH_REMOTE_SSH_FS__
      if (bridge !== undefined) {
        try {
          const remote = await bridge[method](payload)
          if (remote !== null && remote !== undefined) return remote
        } catch (error) {
          console.warn('[dsh-remote-ssh] sidebar bridge failed, using local fs:', error)
        }
      }
      return (original as (payload: unknown, ...rest: unknown[]) => unknown)(payload, ...rest)
    }
  }
  wrap('fs.tree', 'tree')
  wrap('fs.read', 'read')
  wrap('fs.write', 'write')
  return api
}
`

function backup(path) {
  const bak = path + '.remote-ssh-bak'
  if (!existsSync(bak)) renameSync(path, bak)
  return bak
}

function restore(path) {
  const bak = path + '.remote-ssh-bak'
  if (!existsSync(bak)) return false
  renameSync(bak, path)
  return true
}

// ---------------------------------------------------------------- revert
if (revert) {
  const doneIndex = restore(INDEX)
  const doneLib = restore(join(pkgDir, 'lib', 'index.js'))
  try { restore(BRIDGE) } catch { /* never created */ }
  // Remove the bridge file even without a backup (it is fully ours).
  if (existsSync(BRIDGE)) {
    const { rmSync } = await import('node:fs')
    rmSync(BRIDGE, { force: true })
  }
  console.log(`reverted: index=${doneIndex} lib=${doneLib}`)
  process.exit(0)
}

// ---------------------------------------------------------------- apply
if (!existsSync(INDEX)) {
  console.error(`not a dsh-better-sidebar package (missing ${INDEX})`)
  process.exit(1)
}

let source = readFileSync(INDEX, 'utf8')
if (!source.includes(MARK)) {
  // Anchor 1: the fs-tree import — add the bridge import after it.
  const importAnchor = "import { isWithin, parentOf, requireAbsolute, listDirectory, rootLabel } from './fs-tree.ts'"
  if (!source.includes(importAnchor)) {
    console.error('anchor 1 (fs-tree import) not found — src NOT patched (continuing to lib)')
  } else {
    // Anchor 2: buildApi's return opening.
    const returnOpen = "  return {\n    'session.cwd'"
    // Anchor 3: buildApi's return closing (browser-probe tail makes it unique).
    const returnClose = "        clearTimeout(timer)\n      }\n    },\n  }\n}"
    if (!source.includes(returnOpen) || !source.includes(returnClose)) {
      console.error('anchor 2/3 (buildApi return) not found — src NOT patched (continuing to lib)')
    } else {
      backup(INDEX)
      source = source
        .replace(importAnchor, `${importAnchor}\n// ${MARK}\nimport { withRemoteFsBridge } from './remote-bridge.ts'`)
        .replace(returnOpen, "  return withRemoteFsBridge({\n    'session.cwd'")
        .replace(returnClose, "        clearTimeout(timer)\n      }\n    },\n  })\n}")
      writeFileSync(INDEX, source, 'utf8')
      writeFileSync(BRIDGE, BRIDGE_SOURCE, 'utf8')
      console.log(`patched src:
  ${INDEX}
  ${BRIDGE} (new)`)
    }
  }
} else {
  console.log('src already patched')
}

// ---------------------------------------------------------------- lib
// The cordis loader resolves the package's "." export — lib/index.js (the
// built bundle), not src/. Patch the bundle too: same wrap, plain JS.
const LIB = join(pkgDir, 'lib', 'index.js')
if (!existsSync(LIB)) {
  console.log('no lib/index.js found (source-only package) — src patch only')
  process.exit(0)
}
let lib = readFileSync(LIB, 'utf8')
if (lib.includes('__dshRemoteFsWrap')) {
  console.log('lib already patched')
  process.exit(0)
}
const libOpen = '\treturn {\n\t\t"session.cwd": (payload) => {'
const libClose = '\t\t\t} catch {\n\t\t\t\treturn { reachable: false };\n\t\t\t} finally {\n\t\t\t\tclearTimeout(timer);\n\t\t\t}\n\t\t}\n\t};\n}'
if (!lib.includes(libOpen) || !lib.includes(libClose)) {
  console.error('lib anchors not found — lib NOT patched (sidebar remote tree inactive)')
  process.exit(1)
}
backup(LIB)
const LIB_WRAP = `
// ${MARK} — wrap fs.tree/fs.read/fs.write with the dsh-remote-ssh bridge.
// The global is read PER CALL: the two plugins' load order is unspecified,
// so the bridge may publish after better-sidebar's apply.
function __dshRemoteFsWrap(api) {
	const wrap = (key, method) => {
		const original = api[key];
		if (typeof original !== "function") return;
		api[key] = async (payload, ...rest) => {
			const bridge = globalThis.__DSH_REMOTE_SSH_FS__;
			if (bridge !== undefined) {
				try {
					const remote = await bridge[method](payload);
					if (remote !== null && remote !== undefined) return remote;
				} catch (error) {
					console.warn("[dsh-remote-ssh] sidebar bridge failed, using local fs:", error);
				}
			}
			return original(payload, ...rest);
		};
	};
	wrap("fs.tree", "tree");
	wrap("fs.read", "read");
	wrap("fs.write", "write");
	return api;
}
`
lib = LIB_WRAP + lib
  .replace(libOpen, '\treturn __dshRemoteFsWrap({\n\t\t"session.cwd": (payload) => {')
  .replace(libClose, '\t\t\t} catch {\n\t\t\t\treturn { reachable: false };\n\t\t\t} finally {\n\t\t\t\tclearTimeout(timer);\n\t\t\t}\n\t\t}\n\t});\n}')
writeFileSync(LIB, lib, 'utf8')
console.log(`patched:
  ${INDEX}
  ${BRIDGE} (new)
  ${LIB}
restart dsh web to load the patched plugin`)
