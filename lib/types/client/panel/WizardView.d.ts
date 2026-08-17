/**
 * The remote-workspace wizard (ZCode-style「远程连接」flow): pick a host →
 * connect with the live log → pick the remote directory → create the remote
 * workspace (marker dir + DSH workspace + rename + first session). Sessions
 * created in that workspace are remote automatically.
 */
import type { SshApi } from '../api.ts';
import type { PanelController } from './controller.ts';
import type { SshHostSummary } from '../../protocol.ts';
/** WizardView props. */
export interface WizardViewProps {
    api: SshApi;
    controller: PanelController;
    hosts: SshHostSummary[];
    /** Try to open the created session in the conversation pane. */
    openSession?: (sessionId: string) => void;
    onExit(): void;
    onHostsChanged(): void;
}
/** The wizard. */
export declare function WizardView({ api, controller, hosts, openSession, onExit, onHostsChanged }: WizardViewProps): import("react").JSX.Element;
