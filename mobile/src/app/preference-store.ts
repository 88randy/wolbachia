import type { KvStore } from "../db/kv-store.ts";
import { DEFAULT_PREFERENCES, parseLocale, parseScheme } from "./preferences.ts";
import type { Preferences } from "./preferences.ts";

export interface PreferenceSnapshot extends Preferences {
  readonly hasError: boolean;
}

/** One local writer per user stores all choices together; UI publishes only committed settings. */
export class PreferenceStore {
  readonly #kv: Pick<KvStore, "get" | "set">;
  readonly #key: string;
  readonly #listeners = new Set<() => void>();
  #tail = Promise.resolve();
  #snapshot: PreferenceSnapshot;

  constructor(
    kv: Pick<KvStore, "get" | "set">,
    owner: string | null,
    initial = DEFAULT_PREFERENCES,
  ) {
    this.#kv = kv;
    this.#key = `preferences:${owner ?? "provisioning"}`;
    this.#snapshot = { ...initial, hasError: false };
  }
  getSnapshot = (): PreferenceSnapshot => this.#snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  #publish(preferences: PreferenceSnapshot): void {
    this.#snapshot = preferences;
    for (const listener of this.#listeners) listener();
  }
  load(): Promise<void> {
    this.#tail = this.#tail.then(async () => {
      try {
        const saved = await this.#kv.get(this.#key);
        if (saved !== null) this.#publish({ ...parsePreferences(saved), hasError: false });
      } catch {
        this.#publish({ ...this.#snapshot, hasError: true });
      }
    });
    return this.#tail;
  }
  change(patch: Partial<Preferences>): Promise<boolean> {
    const change = this.#tail.then(async () => {
      const next = { ...this.#snapshot, ...patch, hasError: false };
      try {
        await this.#kv.set(this.#key, JSON.stringify(next));
        this.#publish(next);
        return true;
      } catch {
        this.#publish({ ...this.#snapshot, hasError: true });
        return false;
      }
    });
    this.#tail = change.then(() => undefined);
    return change;
  }
}

function parsePreferences(saved: string): Preferences {
  const value: unknown = JSON.parse(saved);
  if (!value || typeof value !== "object") return DEFAULT_PREFERENCES;
  const row = value as Record<string, unknown>;
  return {
    scheme: parseScheme(typeof row.scheme === "string" ? row.scheme : null),
    locale: parseLocale(typeof row.locale === "string" ? row.locale : null),
    textSize: row.textSize === "large" ? "large" : "system",
  };
}
