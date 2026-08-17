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
import type { Context } from '@deepseek-ai/cordis';
import z from 'schemastery';
import { HostStore } from './store.ts';
import { CredentialAdapter } from './secrets.ts';
/** Stable cordis plugin name. */
export declare const name = "ssh-bridge";
/** Services required before the SSH surfaces can mount. */
export declare const inject: string[];
/**
 * Settings namespace of the SSH capability — the section the web settings
 * surface edits. Spelled here rather than imported: the browser half spells
 * the same value and must not depend on a Host package.
 */
export declare const SSH_SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
/** Legacy migration journal (marketplace dsh-ssh → this plugin). */
export interface LegacyMigration {
    migrated: number;
    aliases: string[];
}
/** Plugin config, validated by the same-named schemastery schema. */
export interface Config {
    /**
     * When true (default), a system-prompt section announces the SSH plugin to
     * every agent (tools + host store). Set false to keep it silent.
     */
    announceToAgent?: boolean;
    /** Master switch for the plugin (routes, tools, prompt section). */
    enabled?: boolean;
}
export declare const Config: z<Config>;
/** Model-facing announcement: plugin presence, capabilities, and limits. */
export declare const SSH_GUIDANCE = "\u672C\u673A\u5DF2\u5B89\u88C5 dsh-ssh-bridge \u63D2\u4EF6\uFF08\u8FDC\u7A0B\u5F00\u53D1\uFF0CZCode \u98CE\u683C\uFF09\uFF1A\u4FA7\u8FB9\u680F\u300C\u8FDC\u7A0B SSH\u300D\u5165\u53E3\uFF1B\u4E3B\u673A\u914D\u7F6E\u5B58 ~/.dsh/remote-ssh.json\uFF08\u652F\u6301\u4ECE ~/.ssh/config \u5BFC\u5165\uFF09\u3002\u4E24\u79CD\u7528\u6CD5\uFF1A\u2460 \u8FDC\u7A0B\u4F1A\u8BDD\uFF08\u63A8\u8350\uFF09\uFF1A\u7528\u6237\u5728 GUI \u9762\u677F\u628A\u4F1A\u8BDD\u7ED1\u5B9A\u5230\u67D0\u4E3B\u673A\u7684\u8FDC\u7A0B\u76EE\u5F55\u540E\uFF0Cbash / read / write / edit / str_replace_editor / glob / grep \u4F1A\u5728\u8BE5\u8FDC\u7A0B\u76EE\u5F55\u900F\u660E\u6267\u884C\uFF08\u8DEF\u5F84\u6309\u8FDC\u7A0B\u89E3\u6790\uFF0C\u547D\u4EE4\u3001git\u3001\u6784\u5EFA\u3001\u6D4B\u8BD5\u90FD\u5728\u670D\u52A1\u5668\u4E0A\u8DD1\uFF09\u2014\u2014\u6B64\u65F6\u50CF\u5E73\u5E38\u4E00\u6837\u4F7F\u7528\u8FD9\u4E9B\u5DE5\u5177\u5373\u53EF\uFF0C\u4E0D\u8981\u518D\u7528 ssh_* \u5DE5\u5177\u64CD\u4F5C\u540C\u4E00\u76EE\u5F55\u3002\u2461 \u663E\u5F0F\u5DE5\u5177\uFF1Assh_list \u5217\u4E3B\u673A\uFF1Bssh_exec \u6267\u884C\u8FDC\u7A0B\u547D\u4EE4\uFF1Bssh_list_dir \u6D4F\u89C8\u8FDC\u7A0B\u76EE\u5F55\uFF1Bssh_read_file / ssh_write_file \u8BFB\u5199\u8FDC\u7A0B\u6587\u4EF6\uFF1Bssh_upload / ssh_download \u4F20\u8F93\u6587\u4EF6\uFF08\u9002\u5408\u672A\u7ED1\u5B9A\u4F1A\u8BDD\u7684\u4E00\u6B21\u6027\u64CD\u4F5C\uFF09\u3002\u652F\u6301\u5BC6\u94A5/\u5BC6\u7801\u8BA4\u8BC1\u3001\u5BC6\u94A5\u53E3\u4EE4\u4E0E ProxyJump \u8DF3\u677F\u3002\u51ED\u8BC1\u5B89\u5168\uFF1A\u5BC6\u7801\u4E0E\u5BC6\u94A5\u53E3\u4EE4\u5B58\u4E8E DSH \u5B98\u65B9\u51ED\u8BC1\u5E93\uFF0C\u4EC5\u8FDE\u63A5\u65F6\u8BFB\u53D6\u3002\u9650\u5236\uFF1A\u8FDC\u7A0B\u4F1A\u8BDD\u4E2D read_image \u4E0E\u540E\u53F0\u4EFB\u52A1\u4E0D\u53EF\u7528\uFF1B\u5199\u6587\u4EF6\u4E3A\u6574\u4F53\u8986\u76D6\uFF1B\u65AD\u7EBF\u91CD\u8FDE\u53EF\u80FD\u91CD\u653E\u975E\u5E42\u7B49\u547D\u4EE4\uFF1B\u7834\u574F\u6027\u64CD\u4F5C\u5148\u786E\u8BA4\u3002\u7528\u6237\u63D0\u5230\u300CSSH / \u8FDC\u7A0B\u670D\u52A1\u5668 / \u670D\u52A1\u5668\u4E0A\u7684\u9879\u76EE / \u8FDC\u7A0B\u5F00\u53D1 / \u90E8\u7F72\u300D\u65F6\u5373\u6307\u672C\u63D2\u4EF6\u3002";
/**
 * Mount the SSH engine, routes, tools, and announcement.
 * @param ctx - host plugin context carrying webServer/tools/systemPrompt/credentials.
 * @param config - resolved plugin config (schema defaults applied by the loader).
 */
export declare function apply(ctx: Context, config?: Config): void;
/**
 * Lift the marketplace dsh-ssh plugin's hosts into this store once, moving
 * any inline plaintext secrets into the DSH credential store.
 * @returns the migration journal.
 */
export declare function migrateLegacyStore(store: HostStore, vault: CredentialAdapter): Promise<LegacyMigration>;
