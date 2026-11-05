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
  readonly #allowCleartext: boolean;
  #override: string | null = null;

  constructor(kv: KvStore, buildUrl: string | undefined, allowCleartext = false) {
    this.#kv = kv;
    this.#buildUrl = buildUrl;
    this.#allowCleartext = allowCleartext;
  }

  /** Reads the saved override. Call once at startup. */
  async load(): Promise<void> {
    this.#override = await this.#kv.get(KV_KEYS.apiBaseUrlOverride);
  }

  /** The address to use now, or `null` when none is configured. */
  baseUrl(): string | null {
    const fromOverride = parseApiBaseUrl(this.#override ?? undefined, this.#allowCleartext);
    if (fromOverride.ok) return fromOverride.url;
    const fromBuild = parseApiBaseUrl(this.#buildUrl, this.#allowCleartext);
    return fromBuild.ok ? fromBuild.url : null;
  }

  /** The saved override as typed, for the Settings field. */
  savedOverride(): string {
    return this.#override ?? "";
  }

  /** Validates and saves an address. Nothing is saved when it is not valid. */
  async save(input: string): Promise<ApiBaseUrlResult> {
    const result = parseApiBaseUrl(input, this.#allowCleartext);
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
