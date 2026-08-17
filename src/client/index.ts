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
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the slot registry's Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { SshApi } from './api.ts'
import { mountEntry } from './entry.tsx'
import { mountPanel } from './mount.tsx'
import { PanelController } from './panel/controller.ts'
import { sessionBox } from './session-source.ts'

/** Required services (fiber inject waiting — the runtime must be up first). */
export const inject = ['slots']

/** Type-only surface (export discipline: no value exports beyond the plugin contract). */
export type { PanelControllerSnapshot } from './panel/controller.ts'
export type { AppProps } from './panel/App.tsx'
export type { HostListProps } from './panel/HostList.tsx'
export type { HostFormProps } from './panel/HostForm.tsx'
export type { FilesTabProps } from './panel/FilesTab.tsx'
export type { TerminalTabProps } from './panel/TerminalTab.tsx'

/**
 * Mount the remote SSH dock.
 * @param ctx - client root context (slot registry service).
 */
export function apply(ctx: ClientContext): void {
  const controller = new PanelController()
  const api = new SshApi()
  // The chat session a remote-session binding targets. Primary source: the
  // slot-injected useSessions hook sampled by the entry component into
  // sessionBox (the proven channel in this app). Fallback: the sessions
  // service snapshots, read defensively.
  const currentSessionId = (): string | undefined => {
    if (sessionBox.current !== undefined) return sessionBox.current
    try {
      const sessions = (ctx as unknown as {
        sessions?: {
          list?: { getSnapshot(): { current?: string } }
          currentProvideInfo?: { getSnapshot(): { sessionId?: string } }
        }
      }).sessions
      if (sessions === undefined) return undefined
      return sessions.list?.getSnapshot?.().current ?? sessions.currentProvideInfo?.getSnapshot?.().sessionId
    } catch {
      return undefined
    }
  }
  // Open a just-created session in the conversation pane (post-wizard).
  const openSession = (sessionId: string): void => {
    try {
      ;(ctx as unknown as { sessions?: { open?: (id: string) => void } }).sessions?.open?.(sessionId)
    } catch { /* the session still shows up via the wire refresh */ }
  }
  const disposers: Array<() => void> = []
  try {
    disposers.push(mountEntry(ctx, controller))
    disposers.push(mountPanel(controller, api, currentSessionId, openSession))
  } catch (error) {
    // DOM failures degrade the panel, never the GUI.
    console.warn('[dsh-ssh-bridge] mount failed:', error)
  }
  ctx.effect(() => () => {
    for (const dispose of disposers.splice(0)) dispose()
  }, 'dsh-ssh-bridge: ui mounts')
}
