/**
 * Terminal tab: an xterm.js PTY over the host's WebSocket terminal route.
 * It auto-connects for the active host on mount; the remote exit keeps the
 * last output visible and disables input until a reconnect. xterm's
 * stylesheet is injected once per page load (module-level guard).
 */

import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import type { SshApi, TerminalConnection } from '../api.ts'
import { XTERM_CSS } from './xterm.css.ts'
import { tt } from './helpers.ts'
import css from './panel.module.css'

/** Terminal tab props. */
export interface TerminalTabProps {
  api: SshApi
  /** The connected host alias. */
  alias: string
}

/** Terminal session lifecycle state shown in the status banner. */
type TerminalStatus =
  | { kind: 'connecting' }
  | { kind: 'connected' }
  | { kind: 'exited'; detail?: string }
  | { kind: 'error'; detail: string }

/** Injected-once guard for the xterm stylesheet. */
let xtermCssInjected = false

function ensureXtermCss(): void {
  if (xtermCssInjected || typeof document === 'undefined') return
  xtermCssInjected = true
  if (document.querySelector('style[data-dsh-remote-ssh-xterm]') !== null) return
  const style = document.createElement('style')
  style.dataset.dshRemoteSshXterm = ''
  style.textContent = XTERM_CSS
  document.head.appendChild(style)
}

/** The xterm terminal view. */
export function TerminalTab({ api, alias }: TerminalTabProps) {
  const [status, setStatus] = useState<TerminalStatus>({ kind: 'connecting' })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const connRef = useRef<TerminalConnection | null>(null)

  useEffect(() => { ensureXtermCss() }, [])

  const teardown = (): void => {
    const connection = connRef.current
    connRef.current = null
    if (connection !== null) {
      connection.onReady = undefined
      connection.onOutput = undefined
      connection.onExit = undefined
      connection.close()
    }
    termRef.current?.dispose()
    termRef.current = null
    fitRef.current = null
  }

  // Unmount cleanup (never touches state on an unmounting component).
  useEffect(() => () => { teardown() }, [])

  // Keep the terminal fitted to its container.
  useEffect(() => {
    const onResize = (): void => {
      const term = termRef.current
      const fit = fitRef.current
      if (term === null || fit === null) return
      fit.fit()
      connRef.current?.resize(term.cols, term.rows)
    }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize) }
  }, [])

  /** Open (or reopen) the remote shell. */
  const connect = (reconnect: boolean): void => {
    const container = containerRef.current
    if (container === null) return
    teardown()
    setStatus({ kind: 'connecting' })
    const term = new Terminal({
      convertEol: false,
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Consolas, "Liberation Mono", monospace',
      theme: { background: '#0b0e14', foreground: '#d8dee9', cursor: '#a3b8d0' },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    if (reconnect) term.write('\r\n\x1b[90m— reconnect —\x1b[0m\r\n')
    term.open(container)
    fit.fit()
    const connection = api.openTerminal(alias, term.cols, term.rows)
    termRef.current = term
    fitRef.current = fit
    connRef.current = connection
    let settled = false
    const dataSub = term.onData(data => { connection.send(data) })
    connection.onReady = () => {
      setStatus({ kind: 'connected' })
      fit.fit()
      connection.resize(term.cols, term.rows)
    }
    connection.onOutput = data => { term.write(data) }
    connection.onExit = (code, error) => {
      if (settled) return
      settled = true
      dataSub.dispose()
      term.options.disableStdin = true
      connRef.current = null
      // Keep the last output visible; input is now disabled.
      setStatus(error !== undefined ? { kind: 'error', detail: error } : { kind: 'exited' })
    }
  }

  // Auto-connect on mount / host change.
  useEffect(() => {
    const container = containerRef.current
    if (container === null) return
    connect(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alias])

  return (
    <div className={css.body}>
      <div className={css.row}>
        {status.kind === 'connecting' && <span className={css.spinner} aria-hidden="true" />}
        {status.kind === 'connecting' && <span className={css.headerSub}>{tt('term.connecting')}</span>}
        {status.kind === 'connected' && <span className={css.headerSub}>{tt('term.ready')}</span>}
        {status.kind === 'exited' && <span className={css.headerSub}>{tt('term.exited', { detail: '' })}</span>}
        {status.kind === 'error' && <span className={css.headerSub}>{tt('term.error', { error: status.detail })}</span>}
        <span className={css.rowGrow} />
        <button type="button" className={css.ghostButton} onClick={() => { connect(true) }}>{tt('common.retry')}</button>
      </div>
      <div className={css.termWrap}>
        <div ref={containerRef} className={css.termContainer} />
        {status.kind === 'error' && <div className={css.termPlaceholder}>{tt('term.placeholder')}</div>}
      </div>
    </div>
  )
}
