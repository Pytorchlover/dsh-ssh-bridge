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

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the sidebar slot declarations (SlotMap merge) so the
// footer-action key typechecks; erased in the bundle.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { PanelController } from './panel/controller.ts'
import { sessionBox, type SessionsSelectorHook } from './session-source.ts'
import { tt } from './panel/helpers.ts'
import css from './panel/panel.module.css'

/** Stable data attribute identifying the injected entry row. */
export const ENTRY_SELECTOR = '[data-dsh-remote-ssh-entry]'

/** Inline icon (matches the shell's 16px nav-icon look): a terminal prompt glyph. */
const ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M4.5 5.5l2.5 2.5-2.5 2.5"/><path d="M8.5 10.5h3"/></svg>'

/** The official slot seat, when the sidebar shell declares it. */
function mountSlotEntry(ctx: ClientContext, controller: PanelController): () => void {
  const disposeInject = ctx.slots.inject('sidebar.footer.action', () => [
    ctx.slots.register(
      {
        name: 'sidebar.footer.action',
        id: 'remote-ssh-add',
        order: 11,
        label: () => tt('wsAdd.tooltip'),
      },
      (props: { useSessions?: SessionsSelectorHook }) => {
        // Sample the app's current session on every render (the hook
        // subscribes this component to the sessions store) — the dock's
        // bind button reads the box.
        sessionBox.current = props.useSessions?.(state => state.current)
        return (
          <button
            type="button"
            className={css.entry}
            title={tt('wsAdd.tooltip')}
            onClick={() => { controller.openWizard() }}
          >
            <span className={css.entryLabel}>＋ {tt('wsAdd.label')}</span>
          </button>
        )
      },
    ),
  ])
  return disposeInject
}

/** Find the sidebar shell root element, or undefined while not yet mounted. */
function sidebarRoot(): HTMLElement | undefined {
  const column = document.querySelector<HTMLElement>('[data-pane="sidebar"], [class*="sidebarCol"]')
  if (column === null) return undefined
  // Current shells wrap the sidebar UI: column > wrapper > root(logoRow owner).
  const logoOwner = column.querySelector<HTMLElement>('[class*="logoRow"]')?.parentElement
  return logoOwner ?? (column.firstElementChild as HTMLElement | undefined)
}

/** The New Session button: nested in the logo row on current shells, a direct child on legacy shells. */
function newSessionButton(root: HTMLElement): HTMLButtonElement | undefined {
  const nested = root.querySelector<HTMLButtonElement>('button[class*="newSession"]')
  if (nested !== null) return nested
  for (const child of root.children) {
    if (child.tagName === 'BUTTON') return child as HTMLButtonElement
  }
  return undefined
}

/** DOM-level entry injection with self-healing placement. */
function mountDomEntry(controller: PanelController): { dispose(): void; placed(): boolean } {
  const entry = document.createElement('button')
  entry.type = 'button'
  entry.dataset.dshRemoteSshEntry = ''
  entry.className = css.entry
  entry.setAttribute('aria-label', tt('entry.label'))
  entry.setAttribute('title', tt('entry.tooltip'))
  entry.innerHTML = '<span class="' + css.entryIcon + '">' + ICON + '</span><span class="' + css.entryLabel + '">' + tt('entry.label') + '</span>'
  entry.addEventListener('click', () => { controller.openWizard() })

  let root: HTMLElement | undefined
  let placed = false

  const placeEntry = (target: HTMLElement): boolean => {
    const button = newSessionButton(target)
    if (button === undefined) return false
    if (entry.parentElement !== target) {
      // Position relative to the family block (entries injected by sibling
      // plugins), never relative to transient logoRow geometry.
      const row = button.closest('[class*="logoRow"]')
      const base = (row !== null && row.parentElement === target) ? row : button
      const family = Array.from(target.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el.matches('[data-dsh-taskboard-entry], [data-dsh-ssh-entry], [data-dsh-remote-ssh-entry]'),
      )
      const anchor = family.length > 0 ? family[family.length - 1].nextElementSibling : base.nextElementSibling
      target.insertBefore(entry, anchor)
    }
    return true
  }

  const tryPlace = (): void => {
    if (root !== undefined && !root.isConnected) {
      rootObserver.disconnect()
      root = undefined
      placed = false
    }
    if (placed) {
      if (document.body.contains(entry)) return
      rootObserver.disconnect()
      root = undefined
      placed = false
    }
    root ??= sidebarRoot()
    if (root === undefined) return
    placed = placeEntry(root)
    if (placed) {
      rootObserver.observe(root, { childList: true, subtree: true })
    }
  }

  // Body-level watcher: notices whole-pane rebuilds after teardowns.
  const waitObserver = new MutationObserver(() => { tryPlace() })
  waitObserver.observe(document.body, { childList: true, subtree: true })

  // Self-heal: if a React re-render displaces the row, re-insert it in the
  // same frame (microtask before paint -> no visible flicker).
  const rootObserver = new MutationObserver(() => {
    if (root === undefined || !root.isConnected) {
      placed = false
      tryPlace()
      return
    }
    if (!root.contains(entry)) {
      placed = placeEntry(root)
    }
  })

  // Reflect the panel's open state on the row (active highlight).
  const syncActive = (): void => {
    if (controller.getSnapshot().panelOpen) entry.dataset.active = 'true'
    else delete entry.dataset.active
  }
  const unsubscribe = controller.subscribe(syncActive)
  syncActive()

  tryPlace()

  return {
    dispose: () => {
      waitObserver.disconnect()
      rootObserver.disconnect()
      unsubscribe()
      entry.remove()
    },
    placed: () => placed || document.body.contains(entry),
  }
}

/** Floating last-resort entry (no sidebar reachable at all). */
function mountFloatEntry(controller: PanelController): () => void {
  const button = document.createElement('button')
  button.type = 'button'
  button.dataset.dshRemoteSshEntry = ''
  button.className = css.floatEntry
  button.setAttribute('aria-label', tt('entry.label'))
  button.innerHTML = '<span class="' + css.entryIcon + '">' + ICON + '</span><span>' + tt('entry.label') + '</span>'
  button.addEventListener('click', () => { controller.openWizard() })
  document.body.appendChild(button)
  return () => { button.remove() }
}

/**
 * The「远程」button injected beside the shell's Add-workspace (+) button:
 * the ZCode-style "local folder OR remote server" choice. The + keeps its
 * native local picker; ours opens the remote-workspace wizard.
 */
function mountAddWorkspaceEntry(controller: PanelController): () => void {
  const button = document.createElement('button')
  button.type = 'button'
  button.dataset.dshRemoteSshAdd = ''
  button.className = css.wsAdd
  button.setAttribute('aria-label', tt('wsAdd.tooltip'))
  button.setAttribute('title', tt('wsAdd.tooltip'))
  button.textContent = tt('wsAdd.label')
  button.addEventListener('click', () => { controller.openWizard() })

  let placed = false
  const place = (): void => {
    try {
      if (placed && document.body.contains(button)) return
      const anchor = document.querySelector('button[aria-label="Add workspace"], button[title="Add workspace"]')
      if (anchor === null || anchor.parentElement === null) {
        placed = false
        return
      }
      if (button.parentElement !== anchor.parentElement) {
        anchor.parentElement.insertBefore(button, anchor.nextSibling)
      }
      placed = true
    } catch {
      // The shell re-renders this header aggressively; the footer entry
      // (remote-ssh-add) always covers this surface — never throw.
      placed = false
    }
  }
  const observer = new MutationObserver(() => { place() })
  observer.observe(document.body, { childList: true, subtree: true })
  // React reconciliation periodically eats foreign nodes here; heal on a
  // timer as well as on mutations.
  const heal = setInterval(() => { place() }, 2000)
  place()
  return () => {
    clearInterval(heal)
    observer.disconnect()
    button.remove()
  }
}

/**
 * Mount the sidebar entry through the best available surface.
 * @param ctx - client root context (slot registry).
 * @param controller - the panel controller the entry toggles.
 * @returns disposer removing the entry and its observers.
 */
export function mountEntry(ctx: ClientContext, controller: PanelController): () => void {
  const disposers: Array<() => void> = [mountAddWorkspaceEntry(controller)]
  // Preferred: the official footer slot, when declared by the shell.
  let slotDeclared = false
  try {
    slotDeclared = ctx.slots.spec('sidebar.footer.action') !== undefined
  } catch {
    slotDeclared = false
  }
  if (slotDeclared) {
    try {
      const disposeSlot = mountSlotEntry(ctx, controller)
      return () => {
        disposeSlot()
        for (const dispose of disposers.splice(0)) dispose()
      }
    } catch (error) {
      console.warn('[dsh-ssh-bridge] slot entry failed, falling back to DOM:', error)
    }
  }

  // Fallback: DOM row injection (+ floating badge if nothing lands).
  const dom = mountDomEntry(controller)
  const failsafe = setTimeout(() => {
    if (!dom.placed()) floatDispose = mountFloatEntry(controller)
  }, 8000)
  let floatDispose: (() => void) | undefined
  return () => {
    clearTimeout(failsafe)
    floatDispose?.()
    dom.dispose()
    for (const dispose of disposers.splice(0)) dispose()
  }
}
