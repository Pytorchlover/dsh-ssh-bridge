/**
 * Files tab: the remote workspace browser. Breadcrumb navigation, directory
 * listing, inline text editor with save, new file/folder, rename, delete,
 * upload (with progress), download, and "set as workspace" (the per-host
 * default directory the agent tools use).
 */
import type { SshApi } from '../api.ts';
/** FilesTab props. */
export interface FilesTabProps {
    api: SshApi;
    alias: string;
    initialDir: string;
    onDirChange(dir: string): void;
    onHostsChanged(): void;
}
/** The remote file browser. */
export declare function FilesTab({ api, alias, initialDir, onDirChange, onHostsChanged }: FilesTabProps): import("react").JSX.Element;
