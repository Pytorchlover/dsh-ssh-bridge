/**
 * Wire contract between the host half (routes.ts) and the browser half
 * (client/api.ts). Pure types only — imported by both halves, bundled into
 * each, no runtime identity to share.
 */
/** Authentication flavors a host entry may carry. */
export type SshAuthKind = 'key' | 'password';
/**
 * Authentication as sent by the browser / API on create or update. Secret
 * VALUES may appear here on write; they are routed into the DSH credential
 * store by the host before anything touches the JSON file.
 */
export interface SshHostAuthInput {
    kind: SshAuthKind;
    /** Absolute path to the private key for 'key' auth. */
    keyPath?: string;
    /** New passphrase for an encrypted key (set only, never read back). */
    passphrase?: string;
    /** New password for 'password' auth (set only, never read back). */
    password?: string;
}
/**
 * Authentication as persisted (secret-free). Only the kind, the key *path*
 * and which credential fields are already configured survive; the secret
 * VALUES live in the DSH credential store, addressed by refs derived from
 * the alias (see secrets.ts).
 */
export interface SshHostAuthStored {
    kind: SshAuthKind;
    /** Absolute path to the private key for 'key' auth. */
    keyPath?: string;
    /** Whether a key passphrase is configured (vault holds the value). */
    passphraseConfigured?: boolean;
    /** Whether a password is configured (vault holds the value). */
    passwordConfigured?: boolean;
}
/** One stored host entry (the ~/.dsh/remote-ssh.json store shape). */
export interface SshHostEntry {
    /** Stable, user-chosen identifier used by every operation. */
    alias: string;
    /** Hostname or IP of the target. */
    host: string;
    /** SSH port (default 22). */
    port: number;
    /** Login user. */
    user: string;
    /** Authentication (secret-free). */
    auth: SshHostAuthStored;
    /**
     * Default remote working directory for this host — the "remote workspace"
     * the connect flow opens and the agent tools default to. Optional; the
     * login shell's home directory is used until set.
     */
    workspace?: string;
    /** Jump chain: local aliases connected through in order (ProxyJump). */
    proxyJump: string[];
    /** Free-form note. */
    description?: string;
    createdAt: number;
    updatedAt: number;
}
/** Public (secret-free) projection of an entry, safe for the browser/agent. */
export interface SshHostSummary {
    alias: string;
    host: string;
    port: number;
    user: string;
    auth: SshAuthKind;
    /** Local private key path (key auth only; a path, never a secret). */
    keyPath?: string;
    /** Whether the key path exists on the host machine (key auth only). */
    keyReady: boolean;
    /** Whether a password is configured in the vault (password auth only). */
    passwordConfigured: boolean;
    /** Whether a key passphrase is configured in the vault (key auth only). */
    passphraseConfigured: boolean;
    /** Default remote workspace directory, when set. */
    workspace?: string;
    proxyJump: string[];
    description?: string;
    createdAt: number;
    updatedAt: number;
}
/** One recent remote workspace (ZCode-style recent connections list). */
export interface RecentWorkspace {
    alias: string;
    /** The remote directory that was open. */
    dir: string;
    /** When it was last opened (epoch ms). */
    at: number;
}
/** One remote-session binding: a DSH session pinned to a remote directory. */
export interface RemoteBinding {
    alias: string;
    dir: string;
}
/** Session-binding route payload (bind / unbind / list). */
export interface SessionBindPayload {
    action: 'bind' | 'unbind' | 'list';
    sessionId?: string;
    alias?: string;
    dir?: string;
}
/** One ~/.ssh/config Host block surfaced for the form's auto-fill picker. */
export interface SshConfigAlias {
    /** The Host pattern (alias) — non-wildcard blocks only. */
    alias: string;
    host: string;
    port: number;
    user?: string;
    identityFile?: string;
    proxyJump?: string;
}
/** Live per-host connection state shown in the host list. */
export interface HostStatus {
    alias: string;
    connected: boolean;
    /** Epoch ms of the last successful connect (undefined when never). */
    since?: number;
    /** Last connection failure message, kept until the next success. */
    lastError?: string;
}
/** Result of one non-interactive command execution. */
export interface ExecResult {
    success: boolean;
    /** Remote exit code, or null when the channel died without one. */
    exitCode: number | null;
    timedOut: boolean;
    stdout: string;
    stderr: string;
    /** Wall-clock duration of the round trip in ms. */
    durationMs: number;
    /** Connection error message when the command never ran. */
    error?: string;
}
/** One directory listing entry (remote file browser). */
export interface RemoteDirEntry {
    name: string;
    type: 'dir' | 'file' | 'other';
    size: number;
    mtimeMs: number;
    mode?: number;
}
/** A remote file's text content (the read endpoint's payload). */
export interface RemoteFileContent {
    path: string;
    content: string;
    bytes: number;
    /** True when the read was cut at the byte budget. */
    truncated: boolean;
    /** Best-effort binary sniff (NUL byte or heavy non-text ratio). */
    binary: boolean;
}
/** Test-connection outcome. */
export interface TestResult {
    ok: boolean;
    latencyMs?: number;
    error?: string;
}
/** SFTP transfer progress frame (upload stream). */
export interface TransferProgress {
    phase: 'connecting' | 'transferring' | 'done' | 'error';
    file: string;
    transferred: number;
    total: number;
    percent: number;
    speedBps?: number;
    error?: string;
}
/** Host edit payload (create/update); 'alias' comes from the URL for updates. */
export interface HostPayload {
    alias?: string;
    host: string;
    port?: number;
    user: string;
    /**
     * Authentication. Required on create; on update an omitted auth keeps the
     * stored configuration. `password`/`passphrase` are write-only: the host
     * routes them into the credential vault, the store only ever sees the
     * secret-free projection, and the browser never receives them back.
     */
    auth?: SshHostAuthInput;
    workspace?: string;
    proxyJump?: string[];
    description?: string;
}
/** Secret-free auth shape the store persists for one entry. */
export interface StorableHostAuth {
    kind: SshAuthKind;
    keyPath?: string;
    passphraseConfigured?: boolean;
    passwordConfigured?: boolean;
}
/** Import outcome from ~/.ssh/config. */
export interface ImportResult {
    parsed: number;
    added: number;
    skipped: number;
    /** Aliases that failed to map (wildcard patterns, missing HostName, ...). */
    skippedNames: string[];
}
/** JSON error body used by every route. */
export interface ApiErrorBody {
    error: string;
}
/**
 * NDJSON lines streamed by the connect endpoint — the ZCode-style live
 * connection log. Terminal frames: 'connected' or 'failed'.
 */
export type ConnectStreamLine = {
    type: 'log';
    line: string;
} | {
    type: 'connected';
    alias: string;
    latencyMs: number;
    home: string;
    workspace?: string;
} | {
    type: 'failed';
    alias: string;
    error: string;
};
/** NDJSON transfer stream line shapes (upload). */
export type TransferStreamLine = {
    type: 'progress';
    progress: TransferProgress;
} | {
    type: 'result';
    ok: boolean;
    transferredBytes?: number;
    error?: string;
};
/** WebSocket terminal protocol frames (host -> client and client -> host). */
export type TerminalServerFrame = {
    type: 'ready';
    alias: string;
} | {
    type: 'output';
    data: string;
} | {
    type: 'exit';
    code: number | null;
    error?: string;
};
export type TerminalClientFrame = {
    type: 'input';
    data: string;
} | {
    type: 'resize';
    cols: number;
    rows: number;
};
/** Route paths the client calls (shared literals). */
export declare const SSH_API_BASE: "/api/remote-ssh";
export declare const SSH_API: {
    readonly hosts: string;
    readonly sshAliases: string;
    readonly importSshConfig: string;
    readonly recents: string;
    readonly status: string;
    readonly session: string;
    readonly workspace: string;
    readonly connect: string;
    readonly disconnect: string;
    readonly exec: string;
    readonly ls: string;
    readonly read: string;
    readonly write: string;
    readonly mkdir: string;
    readonly rename: string;
    readonly remove: string;
    readonly upload: string;
    readonly download: string;
    readonly terminal: string;
};
/**
 * Wrap a shell command so it runs inside a working directory. Single quotes
 * are escaped POSIX-style; an empty cwd returns the command unchanged.
 */
export declare function withCwd(command: string, cwd?: string): string;
