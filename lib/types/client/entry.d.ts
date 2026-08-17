/**
 * Sidebar entry mounting.
 *
 * Preferred path: the official `sidebar.footer.action` list slot declared by
 * the sidebar shell — the documented third-party seat, immune to shell DOM
 * changes. Fallback: DOM-level row injection after the New Session button
 * (self-healing against React re-renders), following the task-board
 * precedent. Last resort: a floating badge button when neither surface is
 * reachable, so the panel is never unreachable.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import type { PanelController } from './panel/controller.ts';
/** Stable data attribute identifying the injected entry row. */
export declare const ENTRY_SELECTOR = "[data-dsh-remote-ssh-entry]";
/**
 * Mount the sidebar entry through the best available surface.
 * @param ctx - client root context (slot registry).
 * @param controller - the panel controller the entry toggles.
 * @returns disposer removing the entry and its observers.
 */
export declare function mountEntry(ctx: ClientContext, controller: PanelController): () => void;
