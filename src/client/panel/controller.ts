/**
 * Panel controller: a tiny observable over the dock's open state. The sidebar
 * entry (slot or DOM row) toggles it; the「远程」button beside Add-workspace
 * opens it straight on the remote-workspace wizard. The dock container's
 * visibility and the entry's active highlight follow it.
 */

/** Snapshot of the controller state. */
export interface PanelControllerSnapshot {
  panelOpen: boolean
  /** Increments every time the remote-workspace wizard is requested. */
  wizardSeq: number
}

/** Minimal observable store for panel visibility. */
export class PanelController {
  private snapshot: PanelControllerSnapshot = { panelOpen: false, wizardSeq: 0 }
  private readonly listeners = new Set<() => void>()

  /** Current snapshot. */
  getSnapshot(): PanelControllerSnapshot {
    return this.snapshot
  }

  /** Subscribe to state changes; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /** Open the dock. */
  open(): void {
    if (this.snapshot.panelOpen) return
    this.snapshot = { ...this.snapshot, panelOpen: true }
    this.emit()
  }

  /** Close the dock. */
  close(): void {
    if (!this.snapshot.panelOpen) return
    this.snapshot = { ...this.snapshot, panelOpen: false }
    this.emit()
  }

  /** Toggle the dock. */
  toggle(): void {
    this.snapshot.panelOpen ? this.close() : this.open()
  }

  /** Open the dock on the remote-workspace wizard. */
  openWizard(): void {
    this.snapshot = { panelOpen: true, wizardSeq: this.snapshot.wizardSeq + 1 }
    this.emit()
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener()
  }
}
