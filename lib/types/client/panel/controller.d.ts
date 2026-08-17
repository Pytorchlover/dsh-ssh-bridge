/**
 * Panel controller: a tiny observable over the dock's open state. The sidebar
 * entry (slot or DOM row) toggles it; the「远程」button beside Add-workspace
 * opens it straight on the remote-workspace wizard. The dock container's
 * visibility and the entry's active highlight follow it.
 */
/** Snapshot of the controller state. */
export interface PanelControllerSnapshot {
    panelOpen: boolean;
    /** Increments every time the remote-workspace wizard is requested. */
    wizardSeq: number;
}
/** Minimal observable store for panel visibility. */
export declare class PanelController {
    private snapshot;
    private readonly listeners;
    /** Current snapshot. */
    getSnapshot(): PanelControllerSnapshot;
    /** Subscribe to state changes; returns the unsubscribe function. */
    subscribe(listener: () => void): () => void;
    /** Open the dock. */
    open(): void;
    /** Close the dock. */
    close(): void;
    /** Toggle the dock. */
    toggle(): void;
    /** Open the dock on the remote-workspace wizard. */
    openWizard(): void;
    private emit;
}
