/**
 * Browser-half entry for the dsh-remote-ssh plugin — runs inside the dsh web
 * GUI. Mounts the two DOM surfaces: the sidebar entry row (official
 * `sidebar.footer.action` slot when declared, DOM injection otherwise) and
 * the ZCode-style remote dock (host manager → live connect log → remote
 * workspace with files / terminal). Failure policy: DOM mounting problems
 * are logged, never thrown — the web shell fails the whole boot when a
 * plugin apply throws, and an external plugin must not take the GUI down.
 *
 * Export discipline (packages/client rule): the /client surface carries what
 * cordis loading needs plus types only — all value exports stay internal.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
/** Required services (fiber inject waiting — the runtime must be up first). */
export declare const inject: string[];
/** Type-only surface (export discipline: no value exports beyond the plugin contract). */
export type { PanelControllerSnapshot } from './panel/controller.ts';
export type { AppProps } from './panel/App.tsx';
export type { HostListProps } from './panel/HostList.tsx';
export type { HostFormProps } from './panel/HostForm.tsx';
export type { FilesTabProps } from './panel/FilesTab.tsx';
export type { TerminalTabProps } from './panel/TerminalTab.tsx';
/**
 * Mount the remote SSH dock.
 * @param ctx - client root context (slot registry service).
 */
export declare function apply(ctx: ClientContext): void;
