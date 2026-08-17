/**
 * Dock panel mounting.
 *
 * The panel is a fixed right-edge overlay rendered into its own container on
 * document.body — it never touches the app's DOM structure, so shell layout
 * updates cannot break it, and closing the dock only hides the React tree
 * (terminal sessions and file state survive).
 */
import type { SshApi } from './api.ts';
import type { PanelController } from './panel/controller.ts';
/** The panel host container (kept in the DOM for the session's lifetime). */
export declare const PANEL_VIEW_SELECTOR = "[data-dsh-remote-ssh-view]";
/**
 * Mount the dock React tree.
 * @param controller - the panel controller driving visibility.
 * @param api - the SSH API client the views operate through.
 * @param currentSessionId - getter for the chat session a binding would target.
 * @param openSession - opens a session id in the conversation pane.
 * @returns disposer unmounting the tree and removing the container.
 */
export declare function mountPanel(controller: PanelController, api: SshApi, currentSessionId?: () => string | undefined, openSession?: (sessionId: string) => void): () => void;
