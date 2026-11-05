import type { CredentialStore, CredentialTransaction } from "../auth/credential-store.ts";
import { KV_KEYS } from "../db/kv-store.ts";
import type { KvStore } from "../db/kv-store.ts";
import type { OutboxRepository } from "../outbox/outbox-repository.ts";
import { parseApiBaseUrl } from "./api-base-url.ts";
import type { ApiBaseUrlResult } from "./api-base-url.ts";

interface ServerIdentity {
  readonly credentials: CredentialStore;
  readonly outbox: Pick<OutboxRepository, "countByStatus">;
  readonly allowCleartext?: boolean;
}
type IdentityBound = { readonly ok: false; readonly problem: "identityBound" };
export type ServerSaveResult = ApiBaseUrlResult | IdentityBound;
export type ServerResetResult = { readonly ok: true } | IdentityBound;
const IDENTITY_BOUND: IdentityBound = { ok: false, problem: "identityBound" };

/** Address is phone identity: mutations share the auth queue and require initial provisioning. */
export class ServerSettings {
  readonly #kv: KvStore;
  readonly #buildUrl: string | undefined;
  readonly #identity: ServerIdentity;
  #override: string | null = null;

  constructor(kv: KvStore, buildUrl: string | undefined, identity: ServerIdentity) {
    this.#kv = kv;
    this.#buildUrl = buildUrl;
    this.#identity = identity;
  }

  async load(): Promise<void> {
    this.#override = await this.#kv.get(KV_KEYS.apiBaseUrlOverride);
  }

  baseUrl(): string | null {
    const allowCleartext = this.#identity.allowCleartext ?? false;
    const fromOverride = parseApiBaseUrl(this.#override ?? undefined, allowCleartext);
    if (fromOverride.ok) return fromOverride.url;
    const fromBuild = parseApiBaseUrl(this.#buildUrl, allowCleartext);
    return fromBuild.ok ? fromBuild.url : null;
  }

  savedOverride(): string {
    return this.#override ?? "";
  }

  canChange(): Promise<boolean> {
    return this.#identity.credentials.runExclusive((transaction) => this.#canChange(transaction));
  }

  save(input: string): Promise<ServerSaveResult> {
    return this.#identity.credentials.runExclusive(async (transaction) => {
      if (!(await this.#canChange(transaction))) return IDENTITY_BOUND;
      const result = parseApiBaseUrl(input, this.#identity.allowCleartext ?? false);
      if (!result.ok) return result;
      await this.#kv.set(KV_KEYS.apiBaseUrlOverride, result.url);
      this.#override = result.url;
      return result;
    });
  }

  clear(): Promise<ServerResetResult> {
    return this.#identity.credentials.runExclusive(async (transaction) => {
      if (!(await this.#canChange(transaction))) return IDENTITY_BOUND;
      await this.#kv.remove(KV_KEYS.apiBaseUrlOverride);
      this.#override = null;
      return { ok: true };
    });
  }

  async #canChange(transaction: CredentialTransaction): Promise<boolean> {
    if (transaction.read().pair !== null) return false;
    if ((await this.#kv.get("session_profile")) !== null) return false;
    const counts = await this.#identity.outbox.countByStatus();
    return counts.pending + counts.sending + counts.error === 0;
  }
}
