/**
 * Credential vault adapter for dsh-ssh-bridge: secrets (passwords, key
 * passphrases) never live in the host JSON store. They ride DSH's official
 * credential store (`ctx.credentials` → `~/.dsh/.credentials.yaml`,
 * owner-only), addressed by deterministic environment-style references
 * derived from the host alias. Host-owned profiles keep only non-secret
 * metadata and "configured" flags; secrets are resolved per connect and
 * never cached across operations.
 */

import type { Context } from '@deepseek-ai/cordis'
import { credentialRef, type CredentialRef } from '@deepseek-ai/dsh-credentials'

/** Credential ref prefix shared by every host's secrets. */
const REF_PREFIX = 'DSH_REMOTE_SSH'

/**
 * Build the set of credential refs for one host alias.
 * @param alias - the stable host alias (letters/digits/dots/hyphens).
 */
export function hostCredentialRefs(alias: string): { password: CredentialRef; passphrase: CredentialRef } {
  const stem = alias.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  return {
    password: credentialRef(`${REF_PREFIX}_${stem}_PASSWORD`),
    passphrase: credentialRef(`${REF_PREFIX}_${stem}_PASSPHRASE`),
  }
}

/**
 * Read-side gateway over DSH's credential service: resolves the password /
 * passphrase for one host at operation time (per-read, never cached).
 */
export interface SshSecretReader {
  /** Resolve the stored SSH password for a host (undefined when unset). */
  getPassword(alias: string): Promise<string | undefined>
  /** Resolve the stored key passphrase for a host (undefined when unset). */
  getPassphrase(alias: string): Promise<string | undefined>
}

/** Write-side gateway over the credential service (routes + migration). */
export interface SshSecretWriter {
  /** Store (or replace) the SSH password for a host. */
  setPassword(alias: string, value: string): Promise<void>
  /** Store (or replace) the key passphrase for a host. */
  setPassphrase(alias: string, value: string): Promise<void>
  /** Forget every secret stored for a host. */
  clear(alias: string): Promise<void>
}

/** Combined gateway the host process actually receives. */
export interface SshVault extends SshSecretReader, SshSecretWriter {}

/**
 * Full adapter wrapping the official DSH credential service. The same
 * instance serves both the engine (read at connect) and the routes (write on
 * host create/update, clear on delete).
 */
export class CredentialAdapter implements SshVault {
  constructor(private readonly credentials: Context['credentials']) {}

  async getPassword(alias: string): Promise<string | undefined> {
    const resolved = await this.credentials.resolve(hostCredentialRefs(alias).password)
    return resolved?.value
  }

  async getPassphrase(alias: string): Promise<string | undefined> {
    const resolved = await this.credentials.resolve(hostCredentialRefs(alias).passphrase)
    return resolved?.value
  }

  async setPassword(alias: string, value: string): Promise<void> {
    if (value) await this.credentials.set(hostCredentialRefs(alias).password, value)
  }

  async setPassphrase(alias: string, value: string): Promise<void> {
    if (value) await this.credentials.set(hostCredentialRefs(alias).passphrase, value)
  }

  async clear(alias: string): Promise<void> {
    const refs = hostCredentialRefs(alias)
    await this.credentials.unset(refs.password)
    await this.credentials.unset(refs.passphrase)
  }
}
