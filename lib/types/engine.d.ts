/**
 * The SSH engine: a per-alias persistent connection pool (ssh2) with jump
 * support, command execution, PTY shells, SFTP file operations and
 * transfers, a connect flow that streams step-by-step logs (the ZCode-style
 * connection log), and per-host liveness status — all living in the host
 * process.
 */
import type { ExecResult, HostStatus, RemoteDirEntry, RemoteFileContent, SshHostEntry, SshHostSummary, TestResult, TransferProgress } from './protocol.ts';
import { type HostStore } from './store.ts';
import type { SshSecretReader } from './secrets.ts';
/** Default engine knobs. */
export interface EngineOptions {
    /** Connections idle longer than this are closed (ms). */
    idleTimeoutMs?: number;
    /** SSH handshake timeout (ms). */
    connectTimeoutMs?: number;
    /** Keepalive ping interval (ms). */
    keepaliveIntervalMs?: number;
    /** Cap on captured stdout/stderr bytes per exec. */
    maxOutputBytes?: number;
    /** Default exec timeout (ms). */
    defaultExecTimeoutMs?: number;
    /** SFTP concurrent channel count for transfers. */
    sftpConcurrency?: number;
    /** Cap on remote file reads (bytes). */
    maxFileBytes?: number;
    /** Secret reader: resolves passwords / key passphrases per connect. */
    secretReader?: SshSecretReader;
}
/** A live PTY shell session. */
export interface ShellSession {
    /** Assign to receive remote output. */
    onData?: (data: Buffer) => void;
    /** Assign to be notified when the channel closes. */
    onExit?: (code: number | null, error?: string) => void;
    /** Write raw input to the shell. */
    send(data: string): void;
    /** Resize the remote PTY. */
    resize(cols: number, rows: number): void;
    /** Close the session and its channel. */
    close(): void;
    /** Pause remote output delivery (transport backpressure). */
    pause(): void;
    /** Resume remote output delivery. */
    resume(): void;
}
/**
 * Resolve the auth secrets for one entry from the vault, if present.
 * Returns an empty object when no reader is wired.
 */
export declare function resolveEntrySecrets(reader: SshSecretReader | undefined, entry: SshHostEntry): Promise<{
    password?: string;
    passphrase?: string;
}>;
/** Outcome of the logged connect flow. */
export interface ConnectOutcome {
    latencyMs: number;
    /** The login shell's home directory (SFTP realpath of '.'). */
    home: string;
}
/** Audit log line kinds. */
export type AuditKind = 'connect' | 'exec' | 'write' | 'mkdir' | 'rename' | 'remove' | 'upload' | 'download';
/**
 * The engine. Owns the pool and all operations. One instance per plugin
 * apply; dispose() closes every connection.
 */
export declare class SshEngine {
    private readonly store;
    private readonly opts;
    private readonly secretReader;
    private readonly pool;
    /** Per-alias last failure message (kept until the next success). */
    private readonly lastErrors;
    /** Append-only audit trail of every remote side effect. */
    private readonly audit;
    /** Per-alias remote command availability (probed once per process). */
    private readonly remoteCmds;
    private sweepTimer;
    /**
     * @param store - the host config store.
     * @param options - engine knobs (defaults applied).
     */
    constructor(store: HostStore, options?: EngineOptions);
    /** Secret-free host list (filtered by the optional query). */
    list(query?: string): SshHostSummary[];
    /** One host summary by alias. */
    find(alias: string): SshHostSummary | undefined;
    /** Live connection status for every configured host. */
    status(): HostStatus[];
    /** Close one host's pooled connection (the disconnect route). */
    disconnect(alias: string): boolean;
    /**
     * Run `fn` with a live client for `alias`, reconnecting (up to the
     * attempt budget) when the connection broke mid-flight. Channel-level
     * failures mark the record broken so the next attempt truly reconnects.
     */
    private withClient;
    /**
     * Run `fn` with a fresh SFTP wrapper and ALWAYS close it: every sftp()
     * call opens a new session channel on the connection, and sshd's
     * MaxSessions (default 10) caps concurrently open ones — leaking them
     * exhausts the server and every later channel open fails with
     * "Channel open failure: open failed".
     */
    private withSftp;
    /**
     * Build one full jump chain for an entry: hop clients connected through in
     * order, each forwarding a stream to the next destination, ending with the
     * target client. Shared by the pool and standalone shell sessions; every
     * step is narrated to `onLog` when provided.
     */
    private connectChain;
    /** In-flight acquire promises, deduped per alias (concurrent first use). */
    private readonly acquireQueue;
    /** Connect (or reuse) the pooled chain for one alias. */
    private acquire;
    private doAcquire;
    /**
     * Tear down one alias's record. When `record` is given and no longer the
     * pooled record for the alias (a concurrent acquire replaced it), nothing
     * is torn down — the connection belongs to someone else now.
     */
    private disposeRecord;
    /** Close connections idle beyond the threshold (skips in-flight). */
    private sweep;
    /**
     * The ZCode-style connect flow: narrate every step to `onLog`, ensure a
     * live connection, probe it, and resolve the login home directory.
     */
    connectLogged(alias: string, onLog: (line: string) => void): Promise<ConnectOutcome>;
    /**
     * Whether a command exists on the remote (probed once per alias per
     * process, cached). Lets callers prefer ripgrep and fall back to
     * find/grep on hosts without it.
     */
    hasCmd(alias: string, cmd: string): Promise<boolean>;
    /** Run one command on `alias` (reusing the pooled connection). */
    exec(alias: string, command: string, timeoutMs?: number): Promise<ExecResult>;
    /** Open a PTY shell session for the web terminal (standalone connection). */
    openShell(alias: string, size: {
        cols: number;
        rows: number;
    }): Promise<ShellSession>;
    /** Upload one local file (or directory tree) to a remote path. */
    upload(alias: string, localPath: string, remotePath: string, recursive: boolean, onProgress?: (progress: TransferProgress) => void): Promise<{
        bytes: number;
        files: number;
    }>;
    /** Download one remote file to a local path. */
    download(alias: string, remotePath: string, localPath: string, onProgress?: (progress: TransferProgress) => void): Promise<{
        bytes: number;
    }>;
    /** List a remote directory (file browser). */
    ls(alias: string, path: string): Promise<RemoteDirEntry[]>;
    /** Read one remote file as text (byte-capped, binary-flagged). */
    readFile(alias: string, path: string, maxBytes?: number): Promise<RemoteFileContent>;
    /** Write text to one remote file (creates or truncates). */
    writeFile(alias: string, path: string, content: string): Promise<{
        bytes: number;
    }>;
    /** Create one remote directory (single level). */
    mkdir(alias: string, path: string): Promise<void>;
    /** Rename/move one remote path. */
    rename(alias: string, fromPath: string, toPath: string): Promise<void>;
    /** Delete one remote file or directory (recursive opt-in for directories). */
    remove(alias: string, path: string, recursive: boolean): Promise<void>;
    /** Canonicalize a remote path ('.' → home). */
    realpath(alias: string, path: string): Promise<string>;
    private sftp;
    /** Create a remote directory chain (stat-then-mkdir per segment). */
    private ensureRemoteDir;
    private fastPut;
    private fastGet;
    /** Probe connectivity: connect, run `true`, close nothing (pooled). */
    test(alias: string): Promise<TestResult>;
    /** Close every pooled connection. */
    dispose(): void;
}
