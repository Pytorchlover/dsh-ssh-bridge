/**
 * Host form (modal): the ZCode-style new-connection wizard. A ~/.ssh/config
 * alias picker auto-fills host/port/user/key; auth is password or private
 * key (+ optional passphrase). Secrets are write-only — they go to the DSH
 * credential vault and are never read back into the form.
 */
import type { SshApi } from '../api.ts';
import type { SshHostSummary } from '../../protocol.ts';
/** HostForm props. */
export interface HostFormProps {
    api: SshApi;
    /** The host being edited, or undefined to create. */
    editing?: SshHostSummary;
    onClose(): void;
}
/** The host form modal. */
export declare function HostForm({ api, editing, onClose }: HostFormProps): import("react").JSX.Element;
