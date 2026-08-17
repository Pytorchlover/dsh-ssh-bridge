/**
 * Host config store: one JSON file (`~/.dsh/remote-ssh.json`) holding every
 * SSH host entry plus the recent remote workspaces, written atomically
 * (tmp + rename). Also parses the user's standard `~/.ssh/config` — both for
 * the form's alias auto-fill (read-only) and for one-shot import.
 *
 * SECURITY: this file never contains secret material. Passwords and key
 * passphrases live in DSH's official credential store (ctx.credentials →
 * `~/.dsh/.credentials.yaml`, owner-only) and are resolved per connect.
 *
 * LEGACY: the marketplace dsh-ssh plugin kept its hosts in
 * `~/.dsh/dsh-ssh.json` (with inline plaintext secrets in old versions).
 * `extractLegacyStore()` lifts those entries — and their inline secrets —
 * into this store once, so switching plugins loses nothing.
 */
import type { HostPayload, ImportResult, RecentWorkspace, RemoteBinding, SshConfigAlias, SshHostEntry, SshHostSummary } from './protocol.ts';
/** Store file location: <home>/.dsh/remote-ssh.json. */
export declare function storePath(): string;
/** The legacy marketplace plugin's store location. */
export declare function legacyStorePath(): string;
/** The user's standard OpenSSH config path. */
export declare function sshConfigPath(): string;
/** Validate the wire shape of a host payload; returns a message or undefined. */
export declare function validateHostPayload(payload: unknown): string | undefined;
/** Validate an alias for creation. */
export declare function validateAlias(alias: string): string | undefined;
/**
 * The host store. Pure file I/O — no cordis dependency, unit-testable.
 */
export declare class HostStore {
    /** The JSON file path. */
    readonly path: string;
    /** Optional overrides for tests. */
    private readonly sshConfigOverride;
    private readonly legacyOverride;
    /**
     * @param path - store file path (defaults to the standard location).
     * @param overrides - ssh config / legacy store path overrides (tests only).
     */
    constructor(path?: string, overrides?: {
        sshConfig?: string;
        legacy?: string;
    });
    /** Load all entries (empty store when the file is absent). */
    list(): SshHostEntry[];
    /** Find one entry by alias. */
    find(alias: string): SshHostEntry | undefined;
    /** Secret-free projection for the browser and agent surfaces. */
    summarize(entry: SshHostEntry): SshHostSummary;
    /** Create one entry. Throws on alias collision or invalid payload. */
    create(payload: HostPayload): SshHostEntry;
    /** Update the fields present in `patch`; unknown aliases throw. */
    update(alias: string, patch: Partial<HostPayload>): SshHostEntry;
    /** Remove one entry. */
    delete(alias: string): void;
    /** Remember a workspace opening (ZCode-style recent list, newest first). */
    addRecent(alias: string, dir: string): void;
    /** The recent workspace list (newest first). */
    listRecents(): RecentWorkspace[];
    /** The persisted remote-session bindings (sessionId → remote workspace). */
    loadBindings(): Record<string, RemoteBinding>;
    /** Persist the remote-session bindings map. */
    saveBindings(bindings: Record<string, RemoteBinding>): void;
    /**
     * Read ~/.ssh/config Host blocks for the form's alias auto-fill — a pure
     * read, nothing is created. Non-wildcard blocks with a HostName qualify.
     */
    listSshConfigAliases(): SshConfigAlias[];
    /**
     * Import hosts from `~/.ssh/config`: Host blocks with a single non-wildcard
     * pattern and a HostName become entries (key auth via IdentityFile, jump
     * hosts via ProxyJump). Existing aliases are skipped.
     * @returns import statistics.
     */
    importFromSshConfig(): ImportResult;
    /**
     * Lift the marketplace dsh-ssh plugin's store (`~/.dsh/dsh-ssh.json`) into
     * this store once: every host whose alias does not already exist here is
     * created (including its inline plaintext secret, returned so the caller
     * can move it into the credential vault — this store never persists it).
     * The journal (`migrated`) keeps the operation idempotent.
     * @returns the lifted aliases with any inline secrets found.
     */
    extractLegacyStore(): Array<{
        alias: string;
        password?: string;
        passphrase?: string;
    }>;
    private load;
    private save;
}
/** A non-empty string counts as a configured secret. */
export declare function hasValue(value: string | undefined): boolean;
/** Expand a leading `~` in a filesystem path. */
export declare function expandHome(path: string): string;
