/**
 * Browser-side API client for the /api/remote-ssh route family. The only
 * data access path the panel components use — plain fetch/WebSocket, same
 * origin.
 */
import { type ExecResult, type HostPayload, type HostStatus, type ImportResult, type RecentWorkspace, type RemoteDirEntry, type RemoteFileContent, type SshConfigAlias, type SshHostSummary, type TransferProgress } from '../protocol.ts';
/** Error carrying the route's JSON error message. */
export declare class SshApiError extends Error {
    constructor(message: string);
}
/** One open terminal connection (WebSocket JSON frames). */
export interface TerminalConnection {
    /** Fired on the ready frame (shell is up). */
    onReady: (() => void) | undefined;
    /** Fired on every output frame. */
    onOutput: ((data: string) => void) | undefined;
    /** Fired on the exit frame (or transport error). */
    onExit: ((code: number | null, error?: string) => void) | undefined;
    /** Send raw input to the remote shell. */
    send(data: string): void;
    /** Resize the remote PTY. */
    resize(cols: number, rows: number): void;
    /** Close the socket and the remote session. */
    close(): void;
}
/** Callbacks of the streamed connect flow. */
export interface ConnectCallbacks {
    /** One live connection-log line. */
    onLog(line: string): void;
}
/** Terminal outcome of the connect stream. */
export type ConnectOutcome = {
    ok: true;
    latencyMs: number;
    home: string;
    workspace?: string;
} | {
    ok: false;
    error: string;
};
/** The browser half's only data entry point. */
export declare class SshApi {
    listHosts(queryText?: string): Promise<SshHostSummary[]>;
    createHost(payload: HostPayload): Promise<SshHostSummary>;
    updateHost(alias: string, patch: Partial<HostPayload>): Promise<SshHostSummary>;
    deleteHost(alias: string): Promise<void>;
    /** ~/.ssh/config aliases for the form's auto-fill picker (pure read). */
    sshAliases(): Promise<SshConfigAlias[]>;
    importSshConfig(): Promise<ImportResult>;
    listRecents(): Promise<RecentWorkspace[]>;
    addRecent(alias: string, dir: string): Promise<void>;
    status(): Promise<HostStatus[]>;
    /** All live remote-session bindings. */
    sessionList(): Promise<Array<{
        sessionId: string;
        alias: string;
        dir: string;
    }>>;
    /** Bind one session to a remote directory (remote-session mode on). */
    bindSession(sessionId: string, alias: string, dir: string): Promise<void>;
    /** Remove one session's remote binding (back to local execution). */
    unbindSession(sessionId: string): Promise<void>;
    /** Materialize a remote workspace: marker dir + display title. */
    createRemoteWorkspace(alias: string, dir: string): Promise<{
        path: string;
        title: string;
    }>;
    /**
     * Raw call into the harness's own /api RPC surface (workspace.create /
     * workspace.rename / session.create …). Body: {type, rpcId, method,
     * payload}; the result envelope is unwrapped, !ok throws.
     */
    rpc<T>(endpoint: string, payload: Record<string, unknown>): Promise<T>;
    /**
     * The ZCode-style connect flow: streams the NDJSON connection log to
     * `onLog` line by line, resolves when the terminal frame lands.
     */
    connect(alias: string, callbacks: ConnectCallbacks): Promise<ConnectOutcome>;
    disconnect(alias: string): Promise<boolean>;
    exec(alias: string, command: string, cwd?: string, timeoutMs?: number): Promise<ExecResult>;
    ls(alias: string, path: string): Promise<RemoteDirEntry[]>;
    readFile(alias: string, path: string): Promise<RemoteFileContent>;
    writeFile(alias: string, path: string, content: string): Promise<{
        bytes: number;
    }>;
    mkdir(alias: string, path: string): Promise<void>;
    rename(alias: string, from: string, to: string): Promise<void>;
    remove(alias: string, path: string, recursive: boolean): Promise<void>;
    /**
     * Upload one file (raw bytes) to a remote path. Progress arrives through
     * the NDJSON response stream; resolves when the result frame lands.
     */
    uploadFile(file: File, alias: string, remotePath: string, onProgress?: (progress: TransferProgress) => void): Promise<{
        transferredBytes: number;
    }>;
    /**
     * Download a remote file with client-side progress. Streams straight to
     * disk when the File System Access API is available (no full-file RAM
     * copy); otherwise falls back to an in-memory Blob.
     */
    downloadFile(alias: string, remotePath: string, onProgress?: (progress: TransferProgress) => void): Promise<{
        blob?: Blob;
        filename: string;
        streamed: boolean;
        bytes: number;
    }>;
    /** Open a WebSocket terminal session. */
    openTerminal(alias: string, cols: number, rows: number): TerminalConnection;
}
