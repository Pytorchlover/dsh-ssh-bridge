/**
 * Credential vault adapter for dsh-ssh-bridge: secrets (passwords, key
 * passphrases) never live in the host JSON store. They ride DSH's official
 * credential store (`ctx.credentials` → `~/.dsh/.credentials.yaml`,
 * owner-only), addressed by deterministic environment-style references
 * derived from the host alias. Host-owned profiles keep only non-secret
 * metadata and "configured" flags; secrets are resolved per connect and
 * never cached across operations.
 */
import type { Context } from '@deepseek-ai/cordis';
import { type CredentialRef } from '@deepseek-ai/dsh-credentials';
/**
 * Build the set of credential refs for one host alias.
 * @param alias - the stable host alias (letters/digits/dots/hyphens).
 */
export declare function hostCredentialRefs(alias: string): {
    password: CredentialRef;
    passphrase: CredentialRef;
};
/**
 * Read-side gateway over DSH's credential service: resolves the password /
 * passphrase for one host at operation time (per-read, never cached).
 */
export interface SshSecretReader {
    /** Resolve the stored SSH password for a host (undefined when unset). */
    getPassword(alias: string): Promise<string | undefined>;
    /** Resolve the stored key passphrase for a host (undefined when unset). */
    getPassphrase(alias: string): Promise<string | undefined>;
}
/** Write-side gateway over the credential service (routes + migration). */
export interface SshSecretWriter {
    /** Store (or replace) the SSH password for a host. */
    setPassword(alias: string, value: string): Promise<void>;
    /** Store (or replace) the key passphrase for a host. */
    setPassphrase(alias: string, value: string): Promise<void>;
    /** Forget every secret stored for a host. */
    clear(alias: string): Promise<void>;
}
/** Combined gateway the host process actually receives. */
export interface SshVault extends SshSecretReader, SshSecretWriter {
}
/**
 * Full adapter wrapping the official DSH credential service. The same
 * instance serves both the engine (read at connect) and the routes (write on
 * host create/update, clear on delete).
 */
export declare class CredentialAdapter implements SshVault {
    private readonly credentials;
    constructor(credentials: Context['credentials']);
    getPassword(alias: string): Promise<string | undefined>;
    getPassphrase(alias: string): Promise<string | undefined>;
    setPassword(alias: string, value: string): Promise<void>;
    setPassphrase(alias: string, value: string): Promise<void>;
    clear(alias: string): Promise<void>;
}
