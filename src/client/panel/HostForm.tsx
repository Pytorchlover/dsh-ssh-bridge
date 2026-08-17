/**
 * Host form (modal): the ZCode-style new-connection wizard. A ~/.ssh/config
 * alias picker auto-fills host/port/user/key; auth is password or private
 * key (+ optional passphrase). Secrets are write-only — they go to the DSH
 * credential vault and are never read back into the form.
 */

import { useEffect, useState } from 'react'
import type { SshApi } from '../api.ts'
import type { SshConfigAlias, SshHostSummary } from '../../protocol.ts'
import { errorMessage, tt } from './helpers.ts'
import css from './panel.module.css'

/** HostForm props. */
export interface HostFormProps {
  api: SshApi
  /** The host being edited, or undefined to create. */
  editing?: SshHostSummary
  onClose(): void
}

/** Form field state. */
interface FormState {
  alias: string
  host: string
  port: string
  user: string
  authKind: 'key' | 'password'
  keyPath: string
  passphrase: string
  password: string
  proxyJump: string
  workspace: string
  description: string
}

const EMPTY: FormState = {
  alias: '',
  host: '',
  port: '22',
  user: '',
  authKind: 'key',
  keyPath: '~/.ssh/id_ed25519',
  passphrase: '',
  password: '',
  proxyJump: '',
  workspace: '',
  description: '',
}

/** The host form modal. */
export function HostForm({ api, editing, onClose }: HostFormProps) {
  const [state, setState] = useState<FormState>(() => editing === undefined
    ? EMPTY
    : {
      alias: editing.alias,
      host: editing.host,
      port: String(editing.port),
      user: editing.user,
      authKind: editing.auth,
      keyPath: editing.keyPath ?? '',
      passphrase: '',
      password: '',
      proxyJump: editing.proxyJump.join(','),
      workspace: editing.workspace ?? '',
      description: editing.description ?? '',
    })
  const [aliases, setAliases] = useState<SshConfigAlias[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  // ~/.ssh/config aliases for the auto-fill picker (pure read).
  useEffect(() => {
    let disposed = false
    void (async () => {
      try {
        const list = await api.sshAliases()
        if (!disposed) setAliases(list)
      } catch {
        // No ssh config / unreadable — the picker just stays empty.
      }
    })()
    return () => { disposed = true }
  }, [api])

  const patch = (next: Partial<FormState>): void => { setState(previous => ({ ...previous, ...next })) }

  /** A picked ~/.ssh/config alias fills every field it carries. */
  const applyAlias = (alias: string): void => {
    const found = aliases.find(candidate => candidate.alias === alias)
    if (found === undefined) {
      patch({ alias })
      return
    }
    patch({
      alias: found.alias,
      host: found.host,
      port: String(found.port),
      user: found.user ?? state.user,
      authKind: found.identityFile !== undefined ? 'key' : 'password',
      keyPath: found.identityFile ?? state.keyPath,
      proxyJump: found.proxyJump !== undefined ? found.proxyJump : state.proxyJump,
    })
  }

  const submit = async (): Promise<void> => {
    if (busy) return
    const alias = state.alias.trim()
    if (alias === '' || state.host.trim() === '' || state.user.trim() === '') {
      setError(errorMessage(new Error('alias / host / user required')))
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      const port = Number.parseInt(state.port, 10)
      const auth = {
        kind: state.authKind,
        ...(state.authKind === 'key' ? { keyPath: state.keyPath.trim() } : {}),
        // Write-only secrets: empty string means "keep what's stored" on edit.
        ...(state.password !== '' ? { password: state.password } : {}),
        ...(state.passphrase !== '' ? { passphrase: state.passphrase } : {}),
      }
      if (editing === undefined) {
        await api.createHost({
          alias,
          host: state.host.trim(),
          port: Number.isFinite(port) && port > 0 ? port : 22,
          user: state.user.trim(),
          auth,
          workspace: state.workspace.trim() || undefined,
          proxyJump: state.proxyJump.split(',').map(hop => hop.trim()).filter(hop => hop !== ''),
          description: state.description.trim() || undefined,
        })
      } else {
        await api.updateHost(editing.alias, {
          host: state.host.trim(),
          port: Number.isFinite(port) && port > 0 ? port : 22,
          user: state.user.trim(),
          auth,
          workspace: state.workspace.trim() || undefined,
          proxyJump: state.proxyJump.split(',').map(hop => hop.trim()).filter(hop => hop !== ''),
          description: state.description.trim() || undefined,
        })
      }
      onClose()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={css.modalMask} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className={css.modal}>
        <div className={css.modalTitle}>{editing === undefined ? tt('form.title.create') : tt('form.title.edit', { alias: editing.alias })}</div>

        <div className={css.formGrid}>
          {aliases.length > 0 && (
            <div className={css.field}>
              <label className={css.label} htmlFor="remote-ssh-alias-picker">{tt('form.sshAlias')}</label>
              <select
                id="remote-ssh-alias-picker"
                className={css.select}
                value=""
                onChange={event => { applyAlias(event.target.value) }}
              >
                <option value="">— {tt('form.sshAliasHint')} —</option>
                {aliases.map(candidate => (
                  <option key={candidate.alias} value={candidate.alias}>{candidate.alias} ({candidate.user ? `${candidate.user}@` : ''}{candidate.host}:{candidate.port})</option>
                ))}
              </select>
            </div>
          )}

          <div className={css.field}>
            <label className={css.label} htmlFor="remote-ssh-alias">{tt('form.alias')}</label>
            <input id="remote-ssh-alias" className={css.input} value={state.alias} disabled={editing !== undefined} onChange={event => { patch({ alias: event.target.value }) }} />
            <span className={css.hint}>{tt('form.aliasHint')}</span>
          </div>

          <div className={css.row}>
            <div className={css.field + ' ' + css.rowGrow}>
              <label className={css.label} htmlFor="remote-ssh-host">{tt('form.host')}</label>
              <input id="remote-ssh-host" className={css.input} placeholder="192.168.1.100" value={state.host} onChange={event => { patch({ host: event.target.value }) }} />
              <span className={css.hint}>{tt('form.hostHint')}</span>
            </div>
            <div className={css.field} style={{ width: 96 }}>
              <label className={css.label} htmlFor="remote-ssh-port">{tt('form.port')}</label>
              <input id="remote-ssh-port" className={css.input} inputMode="numeric" value={state.port} onChange={event => { patch({ port: event.target.value }) }} />
            </div>
          </div>

          <div className={css.field}>
            <label className={css.label} htmlFor="remote-ssh-user">{tt('form.user')}</label>
            <input id="remote-ssh-user" className={css.input} placeholder="root / ubuntu / deploy" value={state.user} onChange={event => { patch({ user: event.target.value }) }} />
          </div>

          <div className={css.field}>
            <label className={css.label}>{tt('form.auth')}</label>
            <div className={css.row}>
              <label className={css.row}>
                <input type="radio" name="remote-ssh-auth" checked={state.authKind === 'key'} onChange={() => { patch({ authKind: 'key' }) }} />
                {tt('form.auth.key')}
              </label>
              <label className={css.row}>
                <input type="radio" name="remote-ssh-auth" checked={state.authKind === 'password'} onChange={() => { patch({ authKind: 'password' }) }} />
                {tt('form.auth.password')}
              </label>
            </div>
          </div>

          {state.authKind === 'key' ? (
            <>
              <div className={css.field}>
                <label className={css.label} htmlFor="remote-ssh-key">{tt('form.keyPath')}</label>
                <input id="remote-ssh-key" className={css.input} placeholder="~/.ssh/id_ed25519" value={state.keyPath} onChange={event => { patch({ keyPath: event.target.value }) }} />
                <span className={css.hint}>{tt('form.keyPathHint')}</span>
              </div>
              <div className={css.field}>
                <label className={css.label} htmlFor="remote-ssh-passphrase">{tt('form.passphrase')}</label>
                <input id="remote-ssh-passphrase" type="password" className={css.input} autoComplete="new-password" value={state.passphrase} onChange={event => { patch({ passphrase: event.target.value }) }} />
                <span className={css.hint}>{editing === undefined ? tt('form.passphraseHint') : `${tt('form.passphraseHint')} · ${tt('form.secretKeepHint')}`}</span>
              </div>
            </>
          ) : (
            <div className={css.field}>
              <label className={css.label} htmlFor="remote-ssh-password">{tt('form.password')}</label>
              <input id="remote-ssh-password" type="password" className={css.input} autoComplete="new-password" value={state.password} onChange={event => { patch({ password: event.target.value }) }} />
              <span className={css.hint}>{tt('form.secretHint')}{editing !== undefined ? ` · ${tt('form.secretKeepHint')}` : ''}</span>
            </div>
          )}

          <div className={css.field}>
            <label className={css.label} htmlFor="remote-ssh-workspace">{tt('form.workspace')}</label>
            <input id="remote-ssh-workspace" className={css.input} placeholder="/home/user/project" value={state.workspace} onChange={event => { patch({ workspace: event.target.value }) }} />
            <span className={css.hint}>{tt('form.workspaceHint')}</span>
          </div>

          <div className={css.field}>
            <label className={css.label} htmlFor="remote-ssh-jump">{tt('form.proxyJump')}</label>
            <input id="remote-ssh-jump" className={css.input} placeholder="bastion" value={state.proxyJump} onChange={event => { patch({ proxyJump: event.target.value }) }} />
            <span className={css.hint}>{tt('form.proxyJumpHint')}</span>
          </div>

          <div className={css.field}>
            <label className={css.label} htmlFor="remote-ssh-description">{tt('form.description')}</label>
            <input id="remote-ssh-description" className={css.input} value={state.description} onChange={event => { patch({ description: event.target.value }) }} />
          </div>
        </div>

        {error !== undefined && <div className={css.banner} data-kind="error">{error}</div>}

        <div className={css.row}>
          <span className={css.rowGrow} />
          <button type="button" className={css.ghostButton} onClick={onClose}>{tt('common.cancel')}</button>
          <button type="button" className={css.primaryButton} disabled={busy} onClick={() => { void submit() }}>
            {editing === undefined ? tt('form.submitCreate') : tt('form.submitSave')}
          </button>
        </div>
      </div>
    </div>
  )
}
