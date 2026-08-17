/**
 * The /api/remote-ssh route family: host CRUD, ~/.ssh/config alias reading
 * and import, recents, status, the NDJSON connect log stream, exec, remote
 * file operations (ls / read / write / mkdir / rename / remove), SFTP
 * transfer (NDJSON progress stream for uploads, binary stream for
 * downloads), and the WebSocket PTY terminal upgrade. Every route carries a
 * loopback-only trust fence (plus browser same-origin markers) — these
 * endpoints operate remote servers, so LAN-exposed dsh web deployments must
 * not serve them.
 */
import type { WebRoute, WebUpgradeRoute } from '@deepseek-ai/dsh-host-webserver';
import type { SshEngine } from './engine.ts';
import type { HostStore } from './store.ts';
import type { SshVault } from './secrets.ts';
import type { RemoteBindings } from './remote-session.ts';
/** Route family dependencies. */
export interface SshRoutesDeps {
    /** The host store (CRUD). */
    store: HostStore;
    /** The engine (ops). */
    engine: SshEngine;
    /** Remote-session bindings (the session route). */
    bindings: RemoteBindings;
    /**
     * Secret vault: receives secrets on create/update, forgets them on delete,
     * queried by the engine at connect time. Optional so tests can omit it.
     */
    vault?: SshVault;
    /** Temp dir for upload/download staging (tests inject a sandbox). */
    stagingDir?: string;
}
/**
 * Build every /api/remote-ssh route (exact paths) plus the terminal upgrade.
 * @param deps - store, engine, vault, staging dir.
 * @returns routes and the upgrade route.
 */
export declare function makeRoutes(deps: SshRoutesDeps): {
    routes: WebRoute[];
    upgrade: WebUpgradeRoute;
};
