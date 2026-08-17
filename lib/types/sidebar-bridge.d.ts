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
import type { SshEngine } from './engine.ts';
/** better-sidebar's fs entry shape (src/fs-tree.ts). */
interface SidebarFsEntry {
    name: string;
    path: string;
    isDir: boolean;
    hidden: boolean;
}
/** better-sidebar's fs.tree result shape. */
interface SidebarFsListing {
    path: string;
    entries: SidebarFsEntry[];
    truncated: boolean;
}
/** better-sidebar's fs.read result shape (text / binary variants). */
export type SidebarReadResult = {
    kind: 'text';
    content: string;
    truncated: boolean;
} | {
    kind: 'binary';
    size: number;
    truncated: boolean;
    head: string;
};
/** The global handle the patched better-sidebar calls (null = not remote). */
export interface RemoteFsBridge {
    isRemote(path: string): boolean;
    tree(payload: unknown): Promise<SidebarFsListing | null>;
    read(payload: unknown): Promise<SidebarReadResult | null>;
    write(payload: unknown): Promise<{
        ok: true;
    } | null>;
}
/** The global name the patch looks up (kept in sync with the patch script). */
export declare const BRIDGE_GLOBAL = "__DSH_REMOTE_SSH_FS__";
/**
 * Publish the bridge on globalThis. The patched better-sidebar (same host
 * process) reads it per call; unavailable global → patch is a no-op.
 * @returns disposer removing the global.
 */
export declare function publishSidebarBridge(engine: SshEngine): () => void;
export {};
