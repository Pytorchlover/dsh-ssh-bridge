/**
 * Agent tools: the remote-development surface. Every tool talks to the same
 * engine the web UI uses, so a host configured in the GUI is immediately
 * operable by any agent, and vice versa. Tools mirror the ZCode remote
 * capability set: run commands (git included), read and write remote files,
 * transfer files — all scoped by a per-host remote workspace when one is set.
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { SshEngine } from './engine.ts'
import { withCwd, type ExecResult, type RemoteDirEntry, type RemoteFileContent, type SshHostSummary } from './protocol.ts'

/** One text content block (the only render shape these tools emit). */
function text(value: string): ContentBlock[] {
  return [{ type: 'text', text: value }]
}

/** Host table render shared by list surfaces. */
function renderHosts(hosts: SshHostSummary[]): string {
  if (hosts.length === 0) return 'no hosts configured'
  const rows = hosts.map(host => [
    host.alias,
    `${host.user}@${host.host}:${host.port}`,
    host.auth,
    host.workspace ?? '-',
    host.description ?? '',
  ].join(' | '))
  return ['alias | target | auth | workspace | description', '--- | --- | --- | --- | ---', ...rows].join('\n')
}

/** Render one exec result (mirrors the bash-tool exit-code convention). */
function renderExec(result: ExecResult): string {
  const marker = result.timedOut
    ? '[timed out]'
    : `[exit code: ${result.exitCode ?? 'null'}]`
  const parts = [marker]
  if (result.stdout !== '') parts.push('stdout:\n' + result.stdout)
  if (result.stderr !== '') parts.push('stderr:\n' + result.stderr)
  if (result.error !== undefined) parts.push('error: ' + result.error)
  parts.push(`duration: ${result.durationMs} ms`)
  return parts.join('\n')
}

/** The host-list tool. */
export function sshListTool(engine: SshEngine) {
  return defineTool({
    name: 'ssh_list',
    description: 'List configured SSH remote hosts (alias, user@host:port, auth, default remote workspace, description). Use the alias with ssh_exec / ssh_read_file / ssh_write_file / ssh_upload / ssh_download. ' +
      'Triggers: SSH, remote server, remote development, connect/login to server, deploy, remote files, remote git.',
    parameters: {
      query: { type: 'string', description: 'Optional fuzzy match against alias, description, and host.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          hosts: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                alias: { type: 'string', required: true },
                host: { type: 'string', required: true },
                port: { type: 'integer', required: true },
                user: { type: 'string', required: true },
                auth: { type: 'string', enum: ['key', 'password'], required: true },
                keyPath: { type: 'string', description: 'Local private key path (key auth).' },
                keyReady: { type: 'boolean', required: true },
                passwordConfigured: { type: 'boolean', required: true, description: 'Whether a password credential is currently stored for this host (password auth).' },
                passphraseConfigured: { type: 'boolean', required: true, description: 'Whether a key passphrase credential is stored (key auth).' },
                workspace: { type: 'string', description: 'Default remote working directory for ssh_exec (set in the GUI).' },
                proxyJump: { type: 'array', items: { type: 'string' }, required: true },
                description: { type: 'string' },
                createdAt: { type: 'integer', required: true },
                updatedAt: { type: 'integer', required: true },
              },
            },
          },
        },
      },
      render: (_args, value: { hosts?: SshHostSummary[] }) => text(renderHosts(value.hosts ?? [])),
    },
    async execute(args) {
      return { hosts: engine.list(args.query) }
    },
  })
}

/** The command-execution tool (remote development workhorse). */
export function sshExecTool(engine: SshEngine) {
  return defineTool({
    name: 'ssh_exec',
    description: 'Execute a shell command on a remote SSH host by alias — the remote counterpart of the local bash tool: build, test, inspect logs, control services, and run git (status/diff/commit/log). ' +
      'By default the command runs in the host\'s configured remote workspace (when set); pass cwd to override. Prefer combining independent read-only queries into one command. ' +
      'Triggers: run on the server, remote build/test, deploy, service control, remote git, view remote logs.',
    parameters: {
      alias: { type: 'string', required: true, description: 'Host alias from ssh_list.' },
      command: { type: 'string', required: true, description: 'The shell command to run remotely.' },
      cwd: { type: 'string', description: 'Remote working directory (defaults to the host\'s configured workspace, else the login home).' },
      timeoutMs: { type: 'integer', description: 'Timeout in milliseconds (default 60000).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          success: { type: 'boolean', required: true },
          exitCode: { oneOf: [{ type: 'integer' }, { type: 'null' }], required: true },
          timedOut: { type: 'boolean', required: true },
          stdout: { type: 'string', required: true },
          stderr: { type: 'string', required: true },
          durationMs: { type: 'integer', required: true },
          error: { type: 'string' },
        },
      },
      render: (_args, value: ExecResult) => text(renderExec(value)),
    },
    async execute(args) {
      const resolvedCwd = args.cwd ?? engine.find(args.alias)?.workspace
      return await engine.exec(args.alias, withCwd(args.command, resolvedCwd), args.timeoutMs)
    },
  })
}

/** The remote file read tool. */
export function sshReadFileTool(engine: SshEngine) {
  return defineTool({
    name: 'ssh_read_file',
    description: 'Read one remote file as text (up to 2 MB) — the remote counterpart of reading a file in the local workspace. Use it before ssh_write_file edits, to inspect configs, logs, and source files on the server. ' +
      'Triggers: read remote file, view server config, inspect remote source/log.',
    parameters: {
      alias: { type: 'string', required: true, description: 'Host alias from ssh_list.' },
      path: { type: 'string', required: true, description: 'Absolute remote file path.' },
      maxBytes: { type: 'integer', description: 'Read byte cap (default 2 MB).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          content: { type: 'string', required: true },
          bytes: { type: 'integer', required: true },
          truncated: { type: 'boolean', required: true },
          binary: { type: 'boolean', required: true, description: 'True when the content looks binary (do not edit).' },
        },
      },
      render: (_args, value: RemoteFileContent) => text(
        `${value.path} (${value.bytes} bytes${value.truncated ? ', truncated' : ''}${value.binary ? ', binary' : ''})\n` +
        (value.binary ? '[binary content not shown]' : value.content),
      ),
    },
    async execute(args) {
      return await engine.readFile(args.alias, args.path, args.maxBytes)
    },
  })
}

/** The remote directory listing tool (navigation companion of read/write). */
export function sshListDirTool(engine: SshEngine) {
  return defineTool({
    name: 'ssh_list_dir',
    description: 'List one remote directory (name, type, size, mtime) — the remote counterpart of listing a local directory. Use it to navigate the remote filesystem before reading or writing files. ' +
      'Triggers: list remote directory, browse remote files, remote workspace contents.',
    parameters: {
      alias: { type: 'string', required: true, description: 'Host alias from ssh_list.' },
      path: { type: 'string', required: true, description: 'Absolute remote directory path ("." resolves to the login home).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          entries: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string', required: true },
                type: { type: 'string', enum: ['dir', 'file', 'other'], required: true },
                size: { type: 'integer', required: true },
                mtimeMs: { type: 'integer', required: true },
              },
            },
          },
        },
      },
      render: (_args, value: { path: string; entries: RemoteDirEntry[] }) => text(
        value.entries.length === 0
          ? `${value.path}: empty`
          : [`${value.path}:`, ...value.entries.map(entry => `${entry.type === 'dir' ? 'd' : entry.type === 'file' ? '-' : '?'} ${entry.name}${entry.type === 'dir' ? '/' : ''} (${entry.size} B)`)].join('\n'),
      ),
    },
    async execute(args) {
      return { path: args.path, entries: await engine.ls(args.alias, args.path) }
    },
  })
}

/** The remote file write tool. */
export function sshWriteFileTool(engine: SshEngine) {
  return defineTool({
    name: 'ssh_write_file',
    description: 'Write text content to one remote file (creates or overwrites) — the remote counterpart of editing a file in the local workspace. Read the file first (ssh_read_file) before overwriting; the parent directory must exist (ssh_exec mkdir -p). ' +
      'Triggers: edit remote file, write server config, fix remote source.',
    parameters: {
      alias: { type: 'string', required: true, description: 'Host alias from ssh_list.' },
      path: { type: 'string', required: true, description: 'Absolute remote file path.' },
      content: { type: 'string', required: true, description: 'Full file content to write.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          bytes: { type: 'integer' },
          error: { type: 'string' },
        },
      },
      render: (_args, value: { ok: boolean; bytes?: number; error?: string }) => text(value.ok
        ? `wrote ${value.bytes ?? 0} bytes`
        : `write failed: ${value.error ?? 'unknown error'}`),
    },
    async execute(args) {
      try {
        return { ok: true, ...(await engine.writeFile(args.alias, args.path, args.content)) }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
  })
}

/** The upload tool. */
export function sshUploadTool(engine: SshEngine) {
  return defineTool({
    name: 'ssh_upload',
    description: 'Upload a local file to a remote SSH host. The local path is on THIS machine (the dsh host); the remote destination must be absolute (parent dirs are created). ' +
      'Triggers: upload file to server, deploy artifact, copy build output to server.',
    parameters: {
      alias: { type: 'string', required: true, description: 'Host alias from ssh_list.' },
      localPath: { type: 'string', required: true, description: 'Absolute local file path on this machine.' },
      remotePath: { type: 'string', required: true, description: 'Absolute destination path on the remote host.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          transferredBytes: { type: 'integer' },
          files: { type: 'integer' },
          error: { type: 'string' },
        },
      },
      render: (_args, value: { ok: boolean; transferredBytes?: number; files?: number; error?: string }) => text(value.ok
        ? `uploaded ${value.files ?? 1} file(s), ${value.transferredBytes ?? 0} bytes`
        : `upload failed: ${value.error ?? 'unknown error'}`),
    },
    async execute(args) {
      try {
        const outcome = await engine.upload(args.alias, args.localPath, args.remotePath, false)
        return { ok: true, transferredBytes: outcome.bytes, files: outcome.files }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
  })
}

/** The download tool. */
export function sshDownloadTool(engine: SshEngine) {
  return defineTool({
    name: 'ssh_download',
    description: 'Download a remote FILE from an SSH host to a local path on this machine. Directory download is not supported — download files individually. ' +
      'Triggers: download file from server, fetch remote log/artifact.',
    parameters: {
      alias: { type: 'string', required: true, description: 'Host alias from ssh_list.' },
      remotePath: { type: 'string', required: true, description: 'Remote file path.' },
      localPath: { type: 'string', required: true, description: 'Absolute destination path on this machine.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean', required: true },
          bytes: { type: 'integer' },
          error: { type: 'string' },
        },
      },
      render: (_args, value: { ok: boolean; bytes?: number; error?: string }) => text(value.ok
        ? `downloaded ${value.bytes ?? 0} bytes`
        : `download failed: ${value.error ?? 'unknown error'}`),
    },
    async execute(args) {
      try {
        const outcome = await engine.download(args.alias, args.remotePath, args.localPath)
        return { ok: true, bytes: outcome.bytes }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    },
  })
}
