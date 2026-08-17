/**
 * Panel root: the ZCode-style flow state machine — host list → live connect
 * log → remote workspace (files / terminal). The dock's visibility follows
 * the controller; the React tree stays mounted while hidden so terminal
 * sessions and file state survive close/reopen.
 */
import type { SshApi } from '../api.ts';
import type { PanelController } from './controller.ts';
/** Panel props. */
export interface AppProps {
    api: SshApi;
    controller: PanelController;
    /** The chat session the dock would bind to remote mode (undefined when none). */
    currentSessionId?: () => string | undefined;
    /** Try to open a session id in the conversation pane (post-wizard). */
    openSession?: (sessionId: string) => void;
}
/** The dock application. */
export declare function App({ api, controller, currentSessionId, openSession }: AppProps): import("react").JSX.Element;
