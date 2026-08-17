/**
 * Terminal tab: an xterm.js PTY over the host's WebSocket terminal route.
 * It auto-connects for the active host on mount; the remote exit keeps the
 * last output visible and disables input until a reconnect. xterm's
 * stylesheet is injected once per page load (module-level guard).
 */
import type { SshApi } from '../api.ts';
/** Terminal tab props. */
export interface TerminalTabProps {
    api: SshApi;
    /** The connected host alias. */
    alias: string;
}
/** The xterm terminal view. */
export declare function TerminalTab({ api, alias }: TerminalTabProps): import("react").JSX.Element;
