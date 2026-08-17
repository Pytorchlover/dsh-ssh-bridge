/**
 * Panel root: the ZCode-style flow state machine — host list → live connect
 * log → remote workspace (files / terminal). The dock's visibility follows
 * the controller; the React tree stays mounted while hidden so terminal
 * sessions and file state survive close/reopen.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { SshApi, ConnectOutcome } from '../api.ts'
import type { PanelController } from './controller.ts'
import type { HostStatus, RecentWorkspace, SshHostSummary } from '../../protocol.ts'
import { errorMessage, tt } from './helpers.ts'
import { HostForm } from './HostForm.tsx'
import { HostList } from './HostList.tsx'
import { FilesTab } from './FilesTab.tsx'
import { TerminalTab } from './TerminalTab.tsx'
import { WizardView } from './WizardView.tsx'
import css from './panel.module.css'

/** One connect-log line with its tone. */
interface LogLine {
  text: string
  kind: 'plain' | 'ok' | 'error'
}

/** The wizard/workspace state machine. */
type View =
  | { kind: 'hosts' }
  | { kind: 'form'; editing?: SshHostSummary }
  | { kind: 'connecting'; alias: string }
  | { kind: 'workspace'; alias: string }
  | { kind: 'wizard' }

/** Workspace tab. */
type Tab = 'files' | 'terminal'

/** Panel props. */
export interface AppProps {
  api: SshApi
  controller: PanelController
  /** The chat session the dock would bind to remote mode (undefined when none). */
  currentSessionId?: () => string | undefined
  /** Try to open a session id in the conversation pane (post-wizard). */
  openSession?: (sessionId: string) => void
}

/** The dock application. */
export function App({ api, controller, currentSessionId, openSession }: AppProps) {
  const subscribe = useCallback((listener: () => void) => controller.subscribe(listener), [controller])
  const snapshot = useSyncExternalStore(subscribe, () => controller.getSnapshot())
  const open = snapshot.panelOpen
  const [view, setView] = useState<View>({ kind: 'hosts' })
  const [maximized, setMaximized] = useState(false)
  const [hosts, setHosts] = useState<SshHostSummary[]>([])
  const [statusMap, setStatusMap] = useState<Record<string, HostStatus>>({})
  const [recents, setRecents] = useState<RecentWorkspace[]>([])
  const [logs, setLogs] = useState<LogLine[]>([])
  const [connectState, setConnectState] = useState<{ alias: string; phase: 'connecting' | 'ok' | 'fail'; latencyMs?: number; error?: string }>({ alias: '', phase: 'connecting' })
  const [tab, setTab] = useState<Tab>('files')
  /** Workspace directory of the connected host. */
  const [workspaceDir, setWorkspaceDir] = useState('')
  /** The current session's remote binding (null = unbound, undefined = unknown). */
  const [sessionBinding, setSessionBinding] = useState<{ alias: string; dir: string } | null | undefined>(undefined)
  const [notice, setNotice] = useState<{ kind: 'info' | 'ok' | 'error'; text: string } | undefined>(undefined)
  const connectSeq = useRef(0)

  const flash = useCallback((kind: 'info' | 'ok' | 'error', text: string): void => {
    setNotice({ kind, text })
  }, [])

  // App-level notices self-clear after 6 s.
  useEffect(() => {
    if (notice === undefined) return
    const timer = setTimeout(() => { setNotice(undefined) }, 6000)
    return () => { clearTimeout(timer) }
  }, [notice])

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [nextHosts, nextStatus, nextRecents] = await Promise.all([
        api.listHosts(),
        api.status(),
        api.listRecents(),
      ])
      setHosts(nextHosts)
      setStatusMap(Object.fromEntries(nextStatus.map(entry => [entry.alias, entry])))
      setRecents(nextRecents)
      const sessionId = currentSessionId?.()
      if (sessionId !== undefined) {
        const binding = (await api.sessionList()).find(entry => entry.sessionId === sessionId)
        setSessionBinding(binding === undefined ? null : { alias: binding.alias, dir: binding.dir })
      }
    } catch (error) {
      console.warn('[dsh-ssh-bridge] refresh failed:', errorMessage(error))
    }
  }, [api, currentSessionId])

  useEffect(() => { void refresh() }, [refresh])

  // The「远程」button beside Add-workspace bumps wizardSeq → open the wizard.
  const wizardSeqRef = useRef(0)
  useEffect(() => {
    if (snapshot.wizardSeq === 0 || snapshot.wizardSeq === wizardSeqRef.current) return
    wizardSeqRef.current = snapshot.wizardSeq
    setView({ kind: 'wizard' })
  }, [snapshot.wizardSeq])

  // Liveness refresh while the panel is open (5 s cadence).
  useEffect(() => {
    if (!open) return
    const timer = setInterval(() => { void refresh() }, 5000)
    return () => { clearInterval(timer) }
  }, [open, refresh])

  /** The ZCode-style connect flow: live log lines, then the workspace view. */
  const startConnect = useCallback(async (alias: string, dir?: string): Promise<void> => {
    const seq = ++connectSeq.current
    setLogs([{ text: tt('connect.connecting', { alias }), kind: 'plain' }])
    setConnectState({ alias, phase: 'connecting' })
    setView({ kind: 'connecting', alias })
    const outcome: ConnectOutcome = await api.connect(alias, {
      onLog: line => {
        if (connectSeq.current !== seq) return
        setLogs(previous => [...previous, { text: line, kind: 'plain' }])
      },
    })
    if (connectSeq.current !== seq) return
    if (outcome.ok) {
      setLogs(previous => [...previous, { text: tt('connect.connected', { latency: outcome.latencyMs }), kind: 'ok' }])
      setConnectState({ alias, phase: 'ok', latencyMs: outcome.latencyMs })
      const host = hosts.find(candidate => candidate.alias === alias)
      const dir_ = dir ?? host?.workspace ?? outcome.workspace ?? outcome.home
      setWorkspaceDir(dir_)
      void api.addRecent(alias, dir_).then(() => { void refresh() }).catch(() => undefined)
      setTab('files')
      setView({ kind: 'workspace', alias })
    } else {
      setLogs(previous => [...previous, { text: outcome.error, kind: 'error' }])
      setConnectState({ alias, phase: 'fail', error: outcome.error })
    }
  }, [api, hosts, refresh])

  const backToHosts = useCallback((): void => {
    setView({ kind: 'hosts' })
    void refresh()
  }, [refresh])

  /** Bind the current chat session to the connected remote workspace. */
  const bindSession = async (): Promise<void> => {
    if (view.kind !== 'workspace') return
    if (currentSessionId === undefined) {
      flash('error', tt('ws.noSessionsService'))
      return
    }
    const sessionId = currentSessionId()
    if (sessionId === undefined || sessionId === '') {
      flash('error', tt('ws.noSession'))
      return
    }
    try {
      await api.bindSession(sessionId, view.alias, workspaceDir)
      setSessionBinding({ alias: view.alias, dir: workspaceDir })
      flash('ok', tt('ws.bound', { alias: view.alias, dir: workspaceDir }))
    } catch (error) {
      flash('error', errorMessage(error))
    }
  }

  const unbindSession = async (): Promise<void> => {
    const sessionId = currentSessionId?.()
    if (sessionId === undefined || sessionId === '') return
    try {
      await api.unbindSession(sessionId)
      setSessionBinding(null)
      flash('info', tt('ws.unbind'))
    } catch (error) {
      flash('error', errorMessage(error))
    }
  }

  const disconnect = useCallback(async (): Promise<void> => {
    const alias = view.kind === 'workspace' ? view.alias : connectState.alias
    if (alias === '') return
    try { await api.disconnect(alias) } catch { /* already gone */ }
    setView({ kind: 'hosts' })
    void refresh()
  }, [api, view, connectState.alias, refresh])

  const headerTitle = view.kind === 'workspace'
    ? `${view.alias} · ${workspaceDir}`
    : tt('panel.title')

  return (
    <div className={css.dock} data-open={open} data-maximized={maximized}>
      <div className={css.header}>
        <div className={css.headerTitle} title={headerTitle}>{headerTitle}</div>
        {view.kind === 'workspace' && (
          <button type="button" className={css.ghostButton} onClick={() => { void disconnect() }}>{tt('ws.disconnect')}</button>
        )}
        <button type="button" className={css.ghostButton} onClick={() => { setMaximized(value => !value) }} title={maximized ? tt('panel.restore') : tt('panel.maximize')}>
          {maximized ? '⤡' : '⤢'}
        </button>
        <button type="button" className={css.ghostButton} onClick={() => { controller.close() }} title={tt('panel.close')}>✕</button>
      </div>

      {notice !== undefined && <div className={css.banner} data-kind={notice.kind}>{notice.text}</div>}

      {view.kind === 'workspace' && (
        <div className={css.sessionRow}>
          {sessionBinding != null ? (
            <>
              <span className={css.headerSub} style={{ flex: 1 }}>{tt('ws.bound', { alias: sessionBinding.alias, dir: sessionBinding.dir })}</span>
              <button type="button" className={css.ghostButton} onClick={() => { void unbindSession() }}>{tt('ws.unbind')}</button>
            </>
          ) : (
            <>
              <button type="button" className={css.primaryButton} onClick={() => { void bindSession() }}>{tt('ws.bind')}</button>
              <span className={css.headerSub} style={{ flex: 1 }}>{tt('ws.bindHint')}</span>
            </>
          )}
        </div>
      )}

      {view.kind === 'wizard' && (
        <WizardView
          api={api}
          controller={controller}
          hosts={hosts}
          openSession={openSession}
          onExit={backToHosts}
          onHostsChanged={() => { void refresh() }}
        />
      )}

      {view.kind === 'hosts' && (
        <HostList
          api={api}
          hosts={hosts}
          statusMap={statusMap}
          recents={recents}
          onRefresh={() => { void refresh() }}
          onConnect={(alias, dir) => { void startConnect(alias, dir) }}
          onAdd={() => { setView({ kind: 'form' }) }}
          onEdit={host => { setView({ kind: 'form', editing: host }) }}
          onOpenWizard={() => { setView({ kind: 'wizard' }) }}
        />
      )}

      {view.kind === 'form' && (
        <HostForm
          api={api}
          editing={view.editing}
          onClose={backToHosts}
        />
      )}

      {view.kind === 'connecting' && (
        <ConnectView
          lines={logs}
          state={connectState}
          onBack={backToHosts}
        />
      )}

      {view.kind === 'workspace' && (
        <>
          <div className={css.tabs}>
            <button type="button" className={css.tab} data-active={tab === 'files'} onClick={() => { setTab('files') }}>{tt('ws.files')}</button>
            <button type="button" className={css.tab} data-active={tab === 'terminal'} onClick={() => { setTab('terminal') }}>{tt('ws.terminal')}</button>
          </div>
          {tab === 'files'
            ? <FilesTab api={api} alias={view.alias} initialDir={workspaceDir} onDirChange={setWorkspaceDir} onHostsChanged={() => { void refresh() }} />
            : <TerminalTab api={api} alias={view.alias} />}
        </>
      )}
    </div>
  )
}

/** The live connection-log view (ZCode-style「连接中」step). */
function ConnectView({ lines, state, onBack }: {
  lines: LogLine[]
  state: { alias: string; phase: 'connecting' | 'ok' | 'fail'; latencyMs?: number; error?: string }
  onBack: () => void
}) {
  const logRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [lines])
  return (
    <>
      <div className={css.body}>
        <div className={css.row}>
          {state.phase === 'connecting' && <span className={css.spinner} aria-hidden="true" />}
          {state.phase === 'connecting' && <span className={css.headerSub}>{tt('connect.connecting', { alias: state.alias })}</span>}
          {state.phase === 'ok' && <span className={css.headerSub}>{tt('connect.connected', { latency: state.latencyMs ?? 0 })}</span>}
          {state.phase === 'fail' && <span className={css.headerSub}>{tt('connect.failed')}</span>}
        </div>
        <div ref={logRef} className={css.connectLog}>
          {lines.map((line, index) => (
            <span key={index} className={css.connectLogLine} data-kind={line.kind === 'plain' ? undefined : line.kind}>{line.text}</span>
          ))}
        </div>
        {state.phase !== 'connecting' && (
          <div className={css.row}>
            <button type="button" className={css.primaryButton} onClick={onBack}>{tt('common.back')}</button>
          </div>
        )}
      </div>
    </>
  )
}
