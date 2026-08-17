/**
 * Files tab: the remote workspace browser. Breadcrumb navigation, directory
 * listing, inline text editor with save, new file/folder, rename, delete,
 * upload (with progress), download, and "set as workspace" (the per-host
 * default directory the agent tools use).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SshApi } from '../api.ts'
import type { RemoteDirEntry, RemoteFileContent } from '../../protocol.ts'
import { errorMessage, formatBytes, tt } from './helpers.ts'
import { ICONS } from './HostList.tsx'
import css from './panel.module.css'

/** The editor state while one file is open. */
interface EditorState {
  path: string
  content: string
  binary: boolean
  truncated: boolean
  bytes: number
}

/** FilesTab props. */
export interface FilesTabProps {
  api: SshApi
  alias: string
  initialDir: string
  onDirChange(dir: string): void
  onHostsChanged(): void
}

/** Join a remote directory with a name (forward slashes only). */
function joinRemote(dir: string, name: string): string {
  const base = dir.endsWith('/') ? dir.slice(0, -1) : dir
  return base === '' ? `/${name}` : `${base}/${name}`
}

/** Parent directory ('/' stays '/'). */
function parentRemote(path: string): string {
  const base = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path
  const index = base.lastIndexOf('/')
  return index <= 0 ? '/' : base.slice(0, index)
}

/** Split a path into breadcrumb segments. */
function crumbsOf(path: string): Array<{ label: string; path: string }> {
  const segments = path.split('/').filter(segment => segment !== '')
  const crumbs: Array<{ label: string; path: string }> = [{ label: '/', path: '/' }]
  let acc = ''
  for (const segment of segments) {
    acc += '/' + segment
    crumbs.push({ label: segment, path: acc })
  }
  return crumbs
}

/** The remote file browser. */
export function FilesTab({ api, alias, initialDir, onDirChange, onHostsChanged }: FilesTabProps) {
  const [cwd, setCwd] = useState(initialDir === '' ? '/' : initialDir)
  const [entries, setEntries] = useState<RemoteDirEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [editor, setEditor] = useState<EditorState | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'info' | 'ok' | 'error'; text: string } | undefined>(undefined)
  const [pathInput, setPathInput] = useState('')
  const [uploadPercent, setUploadPercent] = useState<number | undefined>(undefined)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const cwdRef = useRef(cwd)
  cwdRef.current = cwd

  const flash = (kind: 'info' | 'ok' | 'error', text: string): void => { setNotice({ kind, text }) }

  /** Load one directory listing. */
  const load = useCallback(async (dir: string): Promise<void> => {
    setLoading(true)
    setError(undefined)
    try {
      const list = await api.ls(alias, dir === '' ? '/' : dir)
      setEntries(list)
      setCwd(dir === '' ? '/' : dir)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [api, alias])

  /** Change directory + remember it as a recent workspace. */
  const cd = useCallback((dir: string): Promise<void> => {
    onDirChange(dir)
    void api.addRecent(alias, dir).catch(() => undefined)
    return load(dir)
  }, [api, alias, load, onDirChange])

  useEffect(() => { void load(initialDir === '' ? '/' : initialDir) }, [load, initialDir])

  /** Open one file in the inline editor. */
  const openFile = async (path: string): Promise<void> => {
    setLoading(true)
    setError(undefined)
    try {
      const file: RemoteFileContent = await api.readFile(alias, path)
      setEditor({ path, content: file.content, binary: file.binary, truncated: file.truncated, bytes: file.bytes })
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  const saveFile = async (): Promise<void> => {
    if (editor === undefined || saving) return
    setSaving(true)
    try {
      const outcome = await api.writeFile(alias, editor.path, editor.content)
      flash('ok', tt('files.saved', { bytes: outcome.bytes }))
      setEditor(undefined)
      await load(cwdRef.current)
    } catch (cause) {
      flash('error', tt('files.opFailed', { error: errorMessage(cause) }))
    } finally {
      setSaving(false)
    }
  }

  const newEntry = async (kind: 'file' | 'dir'): Promise<void> => {
    const name = window.prompt(kind === 'file' ? tt('files.newFile') : tt('files.newFolder'), '')
    if (name === null || name.trim() === '') return
    const path = joinRemote(cwd, name.trim())
    try {
      if (kind === 'dir') {
        await api.mkdir(alias, path)
      } else {
        await api.writeFile(alias, path, '')
      }
      await load(cwdRef.current)
    } catch (cause) {
      flash('error', tt('files.opFailed', { error: errorMessage(cause) }))
    }
  }

  const renameEntry = async (entry: RemoteDirEntry): Promise<void> => {
    const name = window.prompt(tt('files.renameTo'), entry.name)
    if (name === null || name.trim() === '' || name.trim() === entry.name) return
    try {
      await api.rename(alias, joinRemote(cwd, entry.name), joinRemote(cwd, name.trim()))
      await load(cwdRef.current)
    } catch (cause) {
      flash('error', tt('files.opFailed', { error: errorMessage(cause) }))
    }
  }

  const deleteEntry = async (entry: RemoteDirEntry): Promise<void> => {
    const message = entry.type === 'dir'
      ? tt('files.deleteConfirmDir', { name: entry.name })
      : tt('files.deleteConfirmFile', { name: entry.name })
    if (!window.confirm(message)) return
    try {
      await api.remove(alias, joinRemote(cwd, entry.name), entry.type === 'dir')
      await load(cwdRef.current)
    } catch (cause) {
      flash('error', tt('files.opFailed', { error: errorMessage(cause) }))
    }
  }

  const downloadEntry = async (entry: RemoteDirEntry): Promise<void> => {
    try {
      const outcome = await api.downloadFile(alias, joinRemote(cwd, entry.name))
      if (outcome.blob !== undefined) {
        const url = URL.createObjectURL(outcome.blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = outcome.filename
        anchor.click()
        setTimeout(() => { URL.revokeObjectURL(url) }, 30_000)
      }
      flash('ok', `${outcome.filename} · ${formatBytes(outcome.bytes)}`)
    } catch (cause) {
      flash('error', tt('files.opFailed', { error: errorMessage(cause) }))
    }
  }

  const pickUpload = (): void => { uploadInputRef.current?.click() }

  const doUpload = async (file: File | undefined): Promise<void> => {
    if (file === undefined) return
    setUploadPercent(0)
    try {
      const outcome = await api.uploadFile(file, alias, joinRemote(cwd, file.name), progress => {
        setUploadPercent(progress.percent)
      })
      flash('ok', `${file.name} · ${formatBytes(outcome.transferredBytes)}`)
      await load(cwdRef.current)
    } catch (cause) {
      flash('error', tt('files.opFailed', { error: errorMessage(cause) }))
    } finally {
      setUploadPercent(undefined)
    }
  }

  const setWorkspace = async (): Promise<void> => {
    try {
      await api.updateHost(alias, { workspace: cwd })
      flash('ok', `${tt('ws.workspaceSet')}: ${cwd}`)
      onHostsChanged()
    } catch (cause) {
      flash('error', tt('files.opFailed', { error: errorMessage(cause) }))
    }
  }

  const openPath = async (): Promise<void> => {
    const target = pathInput.trim()
    if (target === '') return
    // Open as directory first; a file error falls through to the editor.
    try {
      await cd(target)
      setPathInput('')
      return
    } catch {
      // Not a directory (or unreadable): try the file editor.
    }
    await openFile(target)
    setPathInput('')
  }

  // ---------------------------------------------------------------- editor
  if (editor !== undefined) {
    return (
      <div className={css.body}>
        <div className={css.row}>
          <button type="button" className={css.ghostButton} onClick={() => { setEditor(undefined) }}>← {tt('common.back')}</button>
          <span className={css.headerSub} style={{ flex: 1 }}>{editor.path}</span>
          <button type="button" className={css.primaryButton} disabled={saving || editor.binary || editor.truncated} onClick={() => { void saveFile() }}>
            {saving ? tt('files.saving') : tt('common.save')}
          </button>
        </div>
        {editor.binary && <div className={css.banner} data-kind="info">{tt('files.binary', { bytes: formatBytes(editor.bytes) })}</div>}
        {editor.truncated && !editor.binary && <div className={css.banner} data-kind="error">{tt('files.truncated', { bytes: formatBytes(editor.bytes) })}</div>}
        <textarea
          className={css.editor}
          spellCheck={false}
          value={editor.content}
          readOnly={editor.binary || editor.truncated}
          onChange={event => { setEditor({ ...editor, content: event.target.value }) }}
        />
      </div>
    )
  }

  // ---------------------------------------------------------------- browser
  return (
    <div className={css.body}>
      <div className={css.crumbs}>
        {crumbsOf(cwd).map((crumb, index, all) => (
          <span key={crumb.path} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {index > 0 && <span>/</span>}
            <button
              type="button"
              className={css.crumb + (index === all.length - 1 ? ' ' + css.crumbLast : '')}
              onClick={() => { void cd(crumb.path) }}
            >
              {crumb.label}
            </button>
          </span>
        ))}
      </div>

      <div className={css.row}>
        <input className={css.input + ' ' + css.rowGrow} placeholder={tt('files.pathPlaceholder')} value={pathInput} onChange={event => { setPathInput(event.target.value) }} onKeyDown={event => { if (event.key === 'Enter') { void openPath() } }} />
        <button type="button" className={css.ghostButton} onClick={() => { void openPath() }}>{tt('files.openPath')}</button>
      </div>

      <div className={css.row}>
        <button type="button" className={css.ghostButton} onClick={() => { void newEntry('file') }}>{tt('files.newFile')}</button>
        <button type="button" className={css.ghostButton} onClick={() => { void newEntry('dir') }}>{tt('files.newFolder')}</button>
        <button type="button" className={css.ghostButton} onClick={pickUpload}>{uploadPercent !== undefined ? tt('files.uploading', { percent: uploadPercent }) : tt('files.upload')}</button>
        <button type="button" className={css.ghostButton} onClick={() => { void setWorkspace() }} title={cwd}>{tt('ws.setWorkspace')}</button>
        <span className={css.rowGrow} />
        <button type="button" className={css.ghostButton} onClick={() => { void cd(parentRemote(cwd)) }}>↑</button>
        <button type="button" className={css.ghostButton} onClick={() => { void load(cwdRef.current) }} title={tt('common.refresh')}>⟳</button>
        <input
          ref={uploadInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={event => { void doUpload(event.target.files?.[0]); event.target.value = '' }}
        />
      </div>

      {notice !== undefined && <div className={css.banner} data-kind={notice.kind}>{notice.text}</div>}
      {error !== undefined && <div className={css.banner} data-kind="error">{tt('files.opFailed', { error })}</div>}
      {loading && <div className={css.row}><span className={css.spinner} aria-hidden="true" /><span className={css.headerSub}>{tt('common.loading')}</span></div>}

      <div className={css.fileList}>
        {entries.map(entry => (
          <div key={entry.name} className={css.fileRow} data-type={entry.type}>
            <span className={css.fileIcon} dangerouslySetInnerHTML={{ __html: entry.type === 'dir' ? ICONS.DIR_ICON : ICONS.FILE_ICON }} />
            <button
              type="button"
              className={css.fileName}
              style={{ all: 'unset', cursor: 'pointer', flex: '1', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={entry.name}
              onClick={() => {
                if (entry.type === 'dir') void cd(joinRemote(cwd, entry.name))
                else if (entry.type === 'file') void openFile(joinRemote(cwd, entry.name))
              }}
            >
              {entry.name}{entry.type === 'dir' ? '/' : ''}
            </button>
            {entry.type === 'file' && <span className={css.fileSize}>{formatBytes(entry.size)}</span>}
            <span className={css.fileActions}>
              {entry.type === 'file' && (
                <button type="button" className={css.iconButton} title={tt('files.download')} onClick={() => { void downloadEntry(entry) }}>⇩</button>
              )}
              <button type="button" className={css.iconButton} title={tt('files.rename')} onClick={() => { void renameEntry(entry) }}>✎</button>
              <button type="button" className={css.iconButton} title={tt('files.delete')} onClick={() => { void deleteEntry(entry) }}>✕</button>
            </span>
          </div>
        ))}
        {!loading && entries.length === 0 && error === undefined && <div className={css.banner} data-kind="info">{tt('files.empty')}</div>}
      </div>
    </div>
  )
}
