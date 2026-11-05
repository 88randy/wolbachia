import { KV_KEYS } from "../db/kv-store.ts";
import type { KvStore } from "../db/kv-store.ts";
import { parseApiBaseUrl } from "./api-base-url.ts";
import type { ApiBaseUrlResult } from "./api-base-url.ts";

/**
 * The API address in force: what a person saved in Settings, otherwise the one baked into the
 * build. A saved address that no longer passes validation is ignored (and the build's is used).
 */
export class ServerSettings {
  readonly #kv: KvStore;
  readonly #buildUrl: string | undefined;
  #override: string | null = null;

  constructor(kv: KvStore, buildUrl: string | undefined) {
    this.#kv = kv;
    this.#buildUrl = buildUrl;
  }

  /** Reads the saved override. Call once at startup. */
  async load(): Promise<void> {
    this.#override = await this.#kv.get(KV_KEYS.apiBaseUrlOverride);
  }

  /** The address to use now, or `null` when none is configured. */
  baseUrl(): string | null {
    const fromOverride = parseApiBaseUrl(this.#override ?? undefined);
    if (fromOverride.ok) return fromOverride.url;
    const fromBuild = parseApiBaseUrl(this.#buildUrl);
    return fromBuild.ok ? fromBuild.url : null;
  }

  /** The saved override as typed, for the Settings field. */
  savedOverride(): string {
    return this.#override ?? "";
  }

  /** Validates and saves an address. Nothing is saved when it is not valid. */
  async save(input: string): Promise<ApiBaseUrlResult> {
    const result = parseApiBaseUrl(input);
    if (!result.ok) return result;
    await this.#kv.set(KV_KEYS.apiBaseUrlOverride, result.url);
    this.#override = result.url;
    return result;
  }

  /** Goes back to the build's address. */
  async clear(): Promise<void> {
    await this.#kv.remove(KV_KEYS.apiBaseUrlOverride);
    this.#override = null;
  }
}
