/**
 * Host list: the panel's landing view. Host cards with liveness dots and a
 * one-click connect, the recent-workspace list underneath (ZCode-style
 * reconnection), and the add / import actions.
 */
import type { SshApi } from '../api.ts';
import type { HostStatus, RecentWorkspace, SshHostSummary } from '../../protocol.ts';
/** HostList props. */
export interface HostListProps {
    api: SshApi;
    hosts: SshHostSummary[];
    statusMap: Record<string, HostStatus>;
    recents: RecentWorkspace[];
    onRefresh(): void;
    onConnect(alias: string, dir?: string): void;
    onAdd(): void;
    onEdit(host: SshHostSummary): void;
    /** Open the remote-workspace wizard (the primary flow). */
    onOpenWizard(): void;
}
/** The host list view. */
export declare function HostList({ api, hosts, statusMap, recents, onRefresh, onConnect, onAdd, onEdit, onOpenWizard }: HostListProps): import("react").JSX.Element;
/** Exposed for the files tab's rows (shared inline icons). */
export declare const ICONS: {
    DIR_ICON: string;
    FILE_ICON: string;
};
