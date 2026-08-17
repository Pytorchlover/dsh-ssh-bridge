/**
 * dsh-remote-ssh — host half. Mounts the SSH engine (persistent ssh2
 * connection pool, exec / PTY shell / SFTP file operations and transfers),
 * the /api/remote-ssh route family plus the terminal WebSocket upgrade, the
 * agent tools (ssh_list, ssh_exec, ssh_list_dir, ssh_read_file,
 * ssh_write_file, ssh_upload, ssh_download), and a system-prompt
 * announcement. The browser half (./client) renders the ZCode-style remote
 * panel: host manager with ~/.ssh/config alias auto-fill, live connect log,
 * remote file browser, and web terminal. Everything rides official NPM SDK
 * packages — no dsh source changes.
 *
 * SECURITY: passwords and key passphrases never live in the host store JSON.
 * They ride DSH's official credential store (`ctx.credentials` →
 * `~/.dsh/.credentials.yaml`, owner-only), addressed by deterministic refs
 * derived from the host alias. `CredentialAdapter` routes write-only secrets
 * into the vault on create/update and resolves them per connection (never
 * cached); files written by `HostStore` are stripped of anything secret.
 */

import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from 'schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import { SshEngine } from './engine.ts'
import { makeRoutes } from './routes.ts'
import { HostStore } from './store.ts'
import { CredentialAdapter } from './secrets.ts'
import { makeRemoteSessionListener, RemoteBindings } from './remote-session.ts'
import { publishSidebarBridge } from './sidebar-bridge.ts'
import { resolveMarkerPath } from './workspace-marker.ts'
import { sshDownloadTool, sshExecTool, sshListDirTool, sshListTool, sshReadFileTool, sshUploadTool, sshWriteFileTool } from './tools.ts'

/** Stable cordis plugin name. */
export const name = 'ssh-bridge'

/** Services required before the SSH surfaces can mount. */
export const inject = ['webServer', 'tools', 'systemPrompt', 'credentials']

/**
 * Settings namespace of the SSH capability — the section the web settings
 * surface edits. Spelled here rather than imported: the browser half spells
 * the same value and must not depend on a Host package.
 */
export const SSH_SETTINGS_NAMESPACE = settingsNamespace('dsh-ssh-bridge')

/** Legacy migration journal (marketplace dsh-ssh → this plugin). */
export interface LegacyMigration {
  migrated: number
  aliases: string[]
}

/** Plugin config, validated by the same-named schemastery schema. */
export interface Config {
  /**
   * When true (default), a system-prompt section announces the SSH plugin to
   * every agent (tools + host store). Set false to keep it silent.
   */
  announceToAgent?: boolean
  /** Master switch for the plugin (routes, tools, prompt section). */
  enabled?: boolean
}

export const Config: z<Config> = z.object({
  announceToAgent: z.boolean().default(true),
  enabled: z.boolean().default(true),
})

/** Schema default, re-read for hand-built test contexts (the loader applies them normally). */
const DEFAULT_ANNOUNCE = true

/** Order of the announcement section within the tool-guidance band. */
const SECTION_ORDER = 150

/** Model-facing announcement: plugin presence, capabilities, and limits. */
export const SSH_GUIDANCE = '本机已安装 dsh-ssh-bridge 插件（远程开发，ZCode 风格）：侧边栏「远程 SSH」入口；主机配置存 ~/.dsh/remote-ssh.json（支持从 ~/.ssh/config 导入）。两种用法：① 远程会话（推荐）：用户在 GUI 面板把会话绑定到某主机的远程目录后，bash / read / write / edit / str_replace_editor / glob / grep 会在该远程目录透明执行（路径按远程解析，命令、git、构建、测试都在服务器上跑）——此时像平常一样使用这些工具即可，不要再用 ssh_* 工具操作同一目录。② 显式工具：ssh_list 列主机；ssh_exec 执行远程命令；ssh_list_dir 浏览远程目录；ssh_read_file / ssh_write_file 读写远程文件；ssh_upload / ssh_download 传输文件（适合未绑定会话的一次性操作）。支持密钥/密码认证、密钥口令与 ProxyJump 跳板。凭证安全：密码与密钥口令存于 DSH 官方凭证库，仅连接时读取。限制：远程会话中 read_image 与后台任务不可用；写文件为整体覆盖；断线重连可能重放非幂等命令；破坏性操作先确认。用户提到「SSH / 远程服务器 / 服务器上的项目 / 远程开发 / 部署」时即指本插件。'

/**
 * Mount the SSH engine, routes, tools, and announcement.
 * @param ctx - host plugin context carrying webServer/tools/systemPrompt/credentials.
 * @param config - resolved plugin config (schema defaults applied by the loader).
 */
export function apply(ctx: Context, config?: Config): void {
  // The live source the surfaces read: the settings section once the web
  // settings surface is served, the composition entry otherwise.
  let current: () => Config = () => config ?? {}
  const resolve = (): Config => {
    const value = current()
    return {
      announceToAgent: value.announceToAgent ?? DEFAULT_ANNOUNCE,
      enabled: value.enabled ?? true,
    }
  }

  const store = new HostStore()
  // The credential vault: routes write on create/update/delete, the engine
  // reads per connect. Falls back to "no stored secrets" when the service is
  // absent in this profile.
  const vault = typeof ctx.credentials?.resolve === 'function' ? new CredentialAdapter(ctx.credentials) : undefined
  // One-time migration: hosts kept by the marketplace dsh-ssh plugin
  // (~/.dsh/dsh-ssh.json, possibly with inline plaintext secrets) move into
  // this store and the official credential store.
  if (vault !== undefined) {
    void migrateLegacyStore(store, vault).catch(() => undefined)
  }

  const engine = new SshEngine(store, { secretReader: vault })
  ctx.effect(() => () => { engine.dispose() }, 'dsh-ssh-bridge: engine')

  // Remote-session bindings: sessionId → remote workspace. The dispatcher
  // below transparently executes the session's workspace tools on the remote.
  const bindings = new RemoteBindings(map => { store.saveBindings(map) }, store.loadBindings())

  // Sessions whose cwd lives inside a remote-workspace marker directory are
  // remote automatically (no explicit binding needed).
  const bindingByCwd = (cwd: string): { alias: string; dir: string } | undefined => {
    const resolved = resolveMarkerPath(cwd)
    return resolved === undefined ? undefined : { alias: resolved.marker.alias, dir: resolved.marker.dir }
  }

  // The better-sidebar explorer bridge: remote trees for marker paths.
  const unpublishBridge = publishSidebarBridge(engine)
  ctx.effect(() => () => { unpublishBridge() }, 'dsh-ssh-bridge: sidebar bridge')

  // The /api/remote-ssh route family + terminal upgrade.
  const { routes, upgrade } = makeRoutes({ store, engine, bindings, vault })
  let disposeRoutes: (() => void) | undefined

  // Agent tools + their prompt sections.
  const tools = [
    sshListTool(engine),
    sshExecTool(engine),
    sshListDirTool(engine),
    sshReadFileTool(engine),
    sshWriteFileTool(engine),
    sshUploadTool(engine),
    sshDownloadTool(engine),
  ]
  let disposeTools: (() => void) | undefined

  // System-prompt announcement.
  let disposeSection: (() => void) | undefined

  // Register (or drop) every surface to match the current source. Each group
  // is kept under one disposer: re-registering first tears the old one down
  // so duplicate-name registrations never throw.
  const sync = (): void => {
    const value = resolve()
    if (disposeSection !== undefined) {
      disposeSection()
      disposeSection = undefined
    }
    if (disposeRoutes !== undefined) {
      disposeRoutes()
      disposeRoutes = undefined
    }
    if (disposeTools !== undefined) {
      disposeTools()
      disposeTools = undefined
    }
    if (!value.enabled) return
    if (value.announceToAgent) {
      disposeSection = ctx.systemPrompt.section({
        name: 'plugin:dsh-ssh-bridge',
        order: SECTION_ORDER,
        text: SSH_GUIDANCE,
      })
    }
    disposeRoutes = ctx.effect(
      () => {
        const disposers = routes.map(route => ctx.webServer.register(route))
        const upgradeDisposer = ctx.webServer.registerUpgrade(upgrade)
        return () => {
          for (const dispose of disposers) dispose()
          upgradeDisposer()
        }
      },
      'dsh-ssh-bridge: routes',
    )
    disposeTools = ctx.effect(
      () => {
        const disposers = tools.map(tool => ctx.tools.register(tool))
        // Remote session mode: around-dispatch on every tool call; bound
        // sessions (explicitly or by marker-directory cwd) get bash / fs /
        // search tools satisfied by the SSH engine. The registry lookup
        // lets the bash value match the registered variant's schema
        // (structured dsh-tool-bash vs string dsh-tool-bash-persistent).
        const disposeListener = ctx.on('tools/execute', makeRemoteSessionListener(
          engine,
          bindings,
          bindingByCwd,
          (name, agent) => ctx.tools.get(name, agent as never),
        ))
        return () => {
          disposeListener()
          for (const dispose of disposers) dispose()
        }
      },
      'dsh-ssh-bridge: tools',
    )
  }

  installSettingsSection(ctx, SSH_SETTINGS_NAMESPACE, Config, config ?? {}, {
    setSource: (source) => {
      current = source
      sync()
    },
    onChange: sync,
  })

  // Initial registration from the composition entry (covers deployments with
  // no settings service, whose installSettingsSection never fires its hooks).
  sync()
}

/**
 * Lift the marketplace dsh-ssh plugin's hosts into this store once, moving
 * any inline plaintext secrets into the DSH credential store.
 * @returns the migration journal.
 */
export async function migrateLegacyStore(store: HostStore, vault: CredentialAdapter): Promise<LegacyMigration> {
  const lifted = store.extractLegacyStore()
  const aliases: string[] = []
  for (const found of lifted) {
    const pending = []
    if (found.password !== undefined) pending.push(vault.setPassword(found.alias, found.password))
    if (found.passphrase !== undefined) pending.push(vault.setPassphrase(found.alias, found.passphrase))
    if (pending.length > 0) {
      await Promise.all(pending)
      aliases.push(found.alias)
    }
  }
  return { migrated: lifted.length, aliases }
}
