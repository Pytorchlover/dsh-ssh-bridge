/**
 * Current-session source. The app's slot system injects a `useSessions`
 * selector hook into slot-registered components (the proven channel other
 * sidebar plugins use); the entry's slot component samples it into this box
 * on every render, and the dock reads the box when binding a session to a
 * remote workspace.
 */

/** Mutable box holding the current chat session id (undefined = none). */
export const sessionBox: { current: string | undefined } = { current: undefined }

/**
 * The selector-hook shape sampled from slot props. Kept structural and loose:
 * the framework injects the full SnapshotSelectorHook<SessionListState>.
 */
export type SessionsSelectorHook = <T>(select: (state: { current?: string }) => T) => T
