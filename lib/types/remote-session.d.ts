/**
 * Remote session mode: bind a DSH session to a remote host directory, then
 * transparently execute the harness's built-in workspace tools ON that
 * remote — the ZCode "session lives on the server" experience.
 *
 * Mechanism: the `tools/execute` around-dispatch waterfall (official
 * @deepseek-ai/dsh-tools extension point). For a bound session, calls to
 * bash / read / write / edit / str_replace_editor / glob / grep /
 * read_image are satisfied by the SSH engine instead of the local machine;
 * every other tool (web, todo, subagent, skills…) passes through untouched.
 * The wrapper returns a value conforming to the ORIGINAL tool's output
 * schema, so the registry renders it with the tool's own presentation —
 * diffs, line numbers, glob cards all look native.
 *
 * Bindings survive host restarts (persisted in ~/.dsh/remote-ssh.json).
 */
import type { ToolDispatchExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools';
import type { SshEngine } from './engine.ts';
import { type RemoteBinding } from './protocol.ts';
/**
 * SessionId → remote workspace. In-memory map with persistence callbacks
 * owned by the host store (persisted in ~/.dsh/remote-ssh.json).
 */
export declare class RemoteBindings {
    /** Persist the full map (called after every mutation). */
    private readonly persist;
    private readonly bindings;
    constructor(
    /** Persist the full map (called after every mutation). */
    persist: (bindings: Record<string, RemoteBinding>) => void, seed?: Record<string, RemoteBinding>);
    /** Bind (or rebind) one session to a remote directory. */
    bind(sessionId: string, alias: string, dir: string): RemoteBinding;
    /** Remove one session's binding (no-op when absent). */
    unbind(sessionId: string): boolean;
    /** One session's binding, when bound. */
    get(sessionId: string): RemoteBinding | undefined;
    /** Every live binding (status surface). */
    list(): Array<{
        sessionId: string;
    } & RemoteBinding>;
    private snapshot;
}
/** Resolve a tool-supplied path against the remote workspace. */
export declare function resolveRemotePath(binding: RemoteBinding, path: string | undefined): string;
/** The minimal tool-definition face the dispatcher needs. */
export interface ToolLikeDefinition {
    output?: {
        schema?: unknown;
    };
}
/**
 * Build the `tools/execute` around-dispatch listener implementing remote
 * session mode. A session is remote when it has an explicit binding OR its
 * cwd lives inside a remote-workspace marker directory (sessions created in
 * a remote workspace are remote automatically). Unbound sessions and
 * non-intercepted tools pass through.
 */
export declare function makeRemoteSessionListener(engine: SshEngine, bindings: RemoteBindings, resolveByCwd?: (cwd: string) => RemoteBinding | undefined, 
/** Registry lookup so the bash value matches the REGISTERED variant's schema. */
getTool?: (name: string, agent: unknown) => ToolLikeDefinition | undefined): (exec: ToolDispatchExecution, next: () => Promise<ToolExecutionResult>) => Promise<ToolExecutionResult>;
