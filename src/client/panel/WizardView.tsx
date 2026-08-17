/**
 * The remote-workspace wizard (ZCode-style「远程连接」flow): pick a host →
 * connect with the live log → pick the remote directory → create the remote
 * workspace (marker dir + DSH workspace + rename + first session). Sessions
 * created in that workspace are remote automatically.
 */

import { useEffect, useRef, useState } from 'react'
import type { SshApi, ConnectOutcome } from '../api.ts'
import type { PanelController } from './controller.ts'
import type { RemoteDirEntry, SshHostSummary } from '../../protocol.ts'
import { errorMessage, tt } from './helpers.ts'
import css from './panel.module.css'

/** WizardView props. */
export interface WizardViewProps {
  api: SshApi
  controller: PanelController
  hosts: SshHostSummary[]
  /** Try to open the created session in the conversation pane. */
  openSession?: (sessionId: string) => void
  onExit(): void
  onHostsChanged(): void
}

/** One wizard log line. */
interface LogLine {
  text: string
  kind: 'plain' | 'ok' | 'error'
}

/** Join a remote dir with a name (forward slashes only). */
function joinRemote(dir: string, name: string): string {
  const base = dir.endsWith('/') ? dir.slice(0, -1) : dir
  return `${base}/${name}`
}

/** Parent directory ('/' stays '/'). */
function parentRemote(path: string): string {
  const base = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path
  const index = base.lastIndexOf('/')
  return index <= 0 ? '/' : base.slice(0, index)
}

/** The wizard. */
export function WizardView({ api, controller, hosts, openSession, onExit, onHostsChanged }: WizardViewProps) {
  const [step, setStep] = useState<'host' | 'connect' | 'dir' | 'finish'>('host')
  const [alias, setAlias] = useState('')
  const [logs, setLogs] = useState<LogLine[]>([])
  const [home, setHome] = useState('/')
  const [cwd, setCwd] = useState('/')
  const [entries, setEntries] = useState<RemoteDirEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [finishing, setFinishing] = useState(false)
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [logs])

  /** Step 2: connect with the live log. */
  const connect = async (target: string): Promise<void> => {
    setAlias(target)
    setLogs([{ text: tt('connect.connecting', { alias: target }), kind: 'plain' }])
    setStep('connect')
    setError(undefined)
    const outcome: ConnectOutcome = await api.connect(target, {
      onLog: line => { setLogs(previous => [...previous, { text: line, kind: 'plain' }]) },
    })
    if (outcome.ok) {
      setLogs(previous => [...previous, { text: tt('connect.connected', { latency: outcome.latencyMs }), kind: 'ok' }])
      setHome(outcome.home)
      await loadDir(outcome.home, target)
      setStep('dir')
    } else {
      setLogs(previous => [...previous, { text: outcome.error, kind: 'error' }])
      setError(outcome.error)
    }
  }

  /** Load one remote directory for the picker. */
  const loadDir = async (dir: string, aliasOverride?: string): Promise<void> => {
    const target = aliasOverride ?? alias
    setLoading(true)
    setError(undefined)
    try {
      const list = await api.ls(target, dir)
      setEntries(list)
      setCwd(dir)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  /** Final step: marker dir + workspace + rename + first session. */
  const finish = async (): Promise<void> => {
    setFinishing(true)
    setError(undefined)
    try {
      const { path, title } = await api.createRemoteWorkspace(alias, cwd)
      const created = await api.rpc<{ workspace: { workspaceId: string }; created: boolean }>('workspace.create', { path })
      await api.rpc('workspace.rename', { workspaceId: created.workspace.workspaceId, title }).catch(() => undefined)
      const session = await api.rpc<{ sessionId: string }>('session.create', { workspaceId: created.workspace.workspaceId })
      openSession?.(session.sessionId)
      onHostsChanged()
      setLogs(previous => [...previous, { text: `${title} ✓`, kind: 'ok' }])
      setStep('finish')
      setTimeout(() => { controller.close() }, 1200)
    } catch (cause) {
      setError(tt('files.opFailed', { error: errorMessage(cause) }))
    } finally {
      setFinishing(false)
    }
  }

  return (
    <div className={css.body}>
      <div className={css.row}>
        <span className={css.headerSub}>
          {tt((step === 'finish' ? 'wizard.step.finish' : step === 'host' ? 'wizard.step.host' : step === 'connect' ? 'wizard.step.connect' : 'wizard.step.dir') as Parameters<typeof tt>[0])} — {alias === '' ? '—' : alias}
        </span>
        <span className={css.rowGrow} />
        <button type="button" className={css.ghostButton} onClick={onExit}>{tt('common.cancel')}</button>
      </div>

      {error !== undefined && <div className={css.banner} data-kind="error">{error}</div>}

      {step === 'host' && (
        <>
          {hosts.length === 0 && <div className={css.banner} data-kind="info">{tt('hosts.empty')}</div>}
          {hosts.map(host => (
            <div key={host.alias} className={css.hostCard}>
              <div className={css.hostMain}>
                <div className={css.hostAlias}>{host.alias}</div>
                <div className={css.hostTarget}>{host.user}@{host.host}:{host.port}</div>
              </div>
              <button type="button" className={css.primaryButton} onClick={() => { void connect(host.alias) }}>{tt('hosts.connect')}</button>
            </div>
          ))}
        </>
      )}

      {(step === 'connect' || step === 'finish') && (
        <>
          <div className={css.row}>
            {step === 'connect' && <span className={css.spinner} aria-hidden="true" />}
            <span className={css.headerSub}>{step === 'connect' ? tt('connect.connecting', { alias }) : tt('wizard.creating')}</span>
          </div>
          <div ref={logRef} className={css.connectLog}>
            {logs.map((line, index) => (
              <span key={index} className={css.connectLogLine} data-kind={line.kind === 'plain' ? undefined : line.kind}>{line.text}</span>
            ))}
          </div>
          {error !== undefined && (
            <div className={css.row}>
              <button type="button" className={css.primaryButton} onClick={() => { setStep('host'); setError(undefined) }}>{tt('common.back')}</button>
            </div>
          )}
        </>
      )}

      {step === 'dir' && (
        <>
          <div className={css.crumbs}>
            <button type="button" className={css.crumb} onClick={() => { void loadDir(home) }}>~</button>
            <span>/</span>
            <span className={css.crumbLast}>{cwd === home ? '' : cwd.replace(home, '').replace(/^\//, '')}</span>
          </div>
          <div className={css.row}>
            <button type="button" className={css.ghostButton} onClick={() => { void loadDir(parentRemote(cwd)) }}>↑</button>
            <button type="button" className={css.ghostButton} onClick={() => { void loadDir(cwd) }} title={tt('common.refresh')}>⟳</button>
            <span className={css.rowGrow} />
            {loading && <span className={css.spinner} aria-hidden="true" />}
          </div>
          <div className={css.fileList}>
            {entries.filter(entry => entry.type === 'dir').map(entry => (
              <button key={entry.name} type="button" className={css.fileRow} onClick={() => { void loadDir(joinRemote(cwd, entry.name)) }}>
                <span className={css.fileName}>{entry.name}/</span>
              </button>
            ))}
            {entries.length === 0 && !loading && <div className={css.banner} data-kind="info">{tt('files.empty')}</div>}
          </div>
          <div className={css.row}>
            <span className={css.headerSub} style={{ flex: 1 }}>{cwd}</span>
            <button type="button" className={css.primaryButton} disabled={finishing} onClick={() => { void finish() }}>
              {finishing ? tt('wizard.creating') : tt('wizard.useDir')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
