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
import type { RemoteBinding } from './protocol.ts';
/** The marker root: <home>/.dsh/remote-ssh/ws. */
export declare function markerRoot(): string;
/** One parsed marker. */
export interface Marker extends RemoteBinding {
    /** The local marker directory (the DSH workspace path). */
    localRoot: string;
}
/**
 * Create (or reuse) the marker directory for one remote workspace.
 * @returns the local marker directory path.
 */
export declare function createMarkerWorkspace(alias: string, dir: string): string;
/** Every existing marker (status surface). */
export declare function listMarkers(): Marker[];
/**
 * Resolve a local path against the marker tree.
 * @returns the marker plus the REMOTE path this local path denotes, or
 * undefined when the path is not under any marker workspace.
 */
export declare function resolveMarkerPath(path: string): {
    marker: Marker;
    remotePath: string;
} | undefined;
/** Is this local path inside a remote-workspace marker? */
export declare function isMarkerPath(path: string): boolean;
