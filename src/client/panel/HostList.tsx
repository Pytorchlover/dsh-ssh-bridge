/**
 * Host list: the panel's landing view. Host cards with liveness dots and a
 * one-click connect, the recent-workspace list underneath (ZCode-style
 * reconnection), and the add / import actions.
 */

import { useEffect, useRef, useState } from 'react'
import type { SshApi } from '../api.ts'
import type { HostStatus, RecentWorkspace, SshHostSummary } from '../../protocol.ts'
import { errorMessage, tt } from './helpers.ts'
import css from './panel.module.css'

/** HostList props. */
export interface HostListProps {
  api: SshApi
  hosts: SshHostSummary[]
  statusMap: Record<string, HostStatus>
  recents: RecentWorkspace[]
  onRefresh(): void
  onConnect(alias: string, dir?: string): void
  onAdd(): void
  onEdit(host: SshHostSummary): void
  /** Open the remote-workspace wizard (the primary flow). */
  onOpenWizard(): void
}

/** Inline SVG icons (16px, currentColor). */
const DIR_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.75 3.5a1 1 0 0 1 1-1h3.1l1.2 1.5h6.2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2.75a1 1 0 0 1-1-1z"/></svg>'
const FILE_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 1.75h5.25L12.5 5.5v8.75a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5z"/><path d="M8.75 1.75V5.5H12.5"/></svg>'

/** The host list view. */
export function HostList({ api, hosts, statusMap, recents, onRefresh, onConnect, onAdd, onEdit, onOpenWizard }: HostListProps) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ kind: 'info' | 'ok' | 'error'; text: string } | undefined>()
  const noteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => { if (noteTimer.current !== undefined) clearTimeout(noteTimer.current) }, [])

  const flash = (kind: 'info' | 'ok' | 'error', text: string): void => {
    setNote({ kind, text })
    if (noteTimer.current !== undefined) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => { setNote(undefined) }, 6000)
  }

  const filtered = query.trim() === ''
    ? hosts
    : hosts.filter(host =>
      host.alias.toLowerCase().includes(query.trim().toLowerCase())
      || host.host.toLowerCase().includes(query.trim().toLowerCase())
      || (host.description ?? '').toLowerCase().includes(query.trim().toLowerCase()))

  const importConfig = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      const result = await api.importSshConfig()
      flash('ok', tt('hosts.imported', { parsed: result.parsed, added: result.added, skipped: result.skipped }))
      onRefresh()
    } catch (error) {
      flash('error', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const deleteHost = async (alias: string): Promise<void> => {
    if (busy) return
    if (!window.confirm(tt('hosts.deleteConfirm', { alias }))) return
    setBusy(true)
    try {
      await api.deleteHost(alias)
      onRefresh()
    } catch (error) {
      flash('error', errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={css.body}>
      <div className={css.row}>
        <input className={css.input + ' ' + css.rowGrow} placeholder={tt('hosts.search')} value={query} onChange={event => { setQuery(event.target.value) }} />
      </div>
      <div className={css.row}>
        <button type="button" className={css.primaryButton} onClick={onOpenWizard}>{tt('wizard.open')}</button>
        <button type="button" className={css.ghostButton} onClick={onAdd}>{tt('hosts.add')}</button>
        <button type="button" className={css.ghostButton} disabled={busy} onClick={() => { void importConfig() }}>{tt('hosts.import')}</button>
        <span className={css.rowGrow} />
        <button type="button" className={css.ghostButton} onClick={onRefresh} title={tt('common.refresh')}>⟳</button>
      </div>

      {note !== undefined && <div className={css.banner} data-kind={note.kind}>{note.text}</div>}

      {filtered.length === 0 && hosts.length === 0 && <div className={css.banner} data-kind="info">{tt('hosts.empty')}</div>}
      {filtered.length === 0 && hosts.length > 0 && <div className={css.banner} data-kind="info">{tt('hosts.unreachable')}</div>}

      {filtered.map(host => {
        const status = statusMap[host.alias]
        const dotState = status?.connected === true ? 'connected' : status?.lastError !== undefined ? 'error' : 'idle'
        const flags: string[] = []
        if (host.auth === 'key' && !host.keyReady) flags.push(tt('hosts.keyMissing'))
        if (host.auth === 'password' && !host.passwordConfigured) flags.push(tt('hosts.passwordMissing'))
        return (
          <div key={host.alias} className={css.hostCard}>
            <span className={css.statusDot} data-state={dotState} title={status?.connected === true ? tt('hosts.connected') : tt('hosts.notConnected')} />
            <div className={css.hostMain}>
              <div className={css.hostAlias}>
                {host.alias}
                {status?.connected === true && <span className={css.hostTarget}>{tt('hosts.connected')}</span>}
              </div>
              <div className={css.hostTarget}>{host.user}@{host.host}:{host.port}</div>
              <div className={css.hostTarget}>
                {tt('hosts.workspace')}: {host.workspace ?? tt('hosts.workspaceUnset')}
              </div>
              {flags.length > 0 && <div className={css.hostFlags}>{flags.join(' · ')}</div>}
              {status?.lastError !== undefined && !status.connected && (
                <div className={css.hostFlags}>{tt('hosts.lastError', { error: status.lastError })}</div>
              )}
            </div>
            <button type="button" className={css.primaryButton} onClick={() => { onConnect(host.alias) }}>{tt('hosts.connect')}</button>
            <button type="button" className={css.ghostButton} onClick={() => { onEdit(host) }}>{tt('hosts.edit')}</button>
            <button type="button" className={css.dangerButton} onClick={() => { void deleteHost(host.alias) }}>{tt('common.delete')}</button>
          </div>
        )
      })}

      {recents.length > 0 && (
        <>
          <div className={css.sectionTitle}>{tt('hosts.recents')}</div>
          {recents.map(recent => (
            <button
              key={`${recent.alias}:${recent.dir}`}
              type="button"
              className={css.recentRow}
              onClick={() => { onConnect(recent.alias, recent.dir) }}
              title={`${recent.alias} ${recent.dir}`}
            >
              <span className={css.fileIcon} dangerouslySetInnerHTML={{ __html: DIR_ICON }} />
              <span className={css.recentAlias}>{recent.alias}</span>
              <span className={css.recentDir}>{recent.dir}</span>
            </button>
          ))}
        </>
      )}
    </div>
  )
}

/** Exposed for the files tab's rows (shared inline icons). */
export const ICONS = { DIR_ICON, FILE_ICON }
