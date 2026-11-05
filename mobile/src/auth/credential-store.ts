import type { Schemas } from "@wolbachia/api-client";

import { PASSWORD_ATTEMPT_LIMIT } from "./pin-rules.ts";
import type { SecretStorage } from "./secret-storage.ts";
import type { Verifier } from "./verifier.ts";

export type TokenPair = Pick<Schemas["RefreshResponse"], "access" | "refresh">;
export type SessionStatus = "active" | "ended";
export interface Credentials {
  readonly status: SessionStatus;
  readonly sessionId: string | null;
  readonly pair: TokenPair | null;
  readonly pin: Verifier | null;
  readonly password: Verifier | null;
  readonly pinAttempts: number;
  readonly passwordAttempts: number;
}
export const EMPTY_CREDENTIALS: Credentials = {
  status: "active",
  sessionId: null,
  pair: null,
  pin: null,
  password: null,
  pinAttempts: 0,
  passwordAttempts: 0,
};
const ITEM = "session_credentials_v1";

/**
 * One serialized read-modify-write queue and ONE SecureStore item, including the token pair.
 * Publish only after persistence. Local counters, refresh and revoke cannot overwrite each other.
 */
export class CredentialStore {
  readonly #storage: SecretStorage;
  readonly #listeners = new Set<() => void>();
  #credentials: Credentials = EMPTY_CREDENTIALS;
  #endingSessionId: string | null = null;
  #tail: Promise<unknown> = Promise.resolve();

  constructor(storage: SecretStorage) {
    this.#storage = storage;
  }

  async load(): Promise<void> {
    const saved = await this.#storage.get(ITEM);
    if (saved !== null) this.#credentials = decodeCredentials(saved);
    // An interrupted final password attempt is conservatively a failure on restart.
    if (this.#credentials.passwordAttempts >= PASSWORD_ATTEMPT_LIMIT) await this.clear();
  }

  getSnapshot = (): Credentials => this.#credentials;
  getAccessToken = (): string | undefined =>
    this.isSessionActive() ? this.#credentials.pair?.access : undefined;
  hasSyncSession = (): boolean => this.#credentials.pair !== null;
  isSessionActive(): boolean {
    return (
      this.#credentials.status === "active" &&
      this.#credentials.pair !== null &&
      this.#credentials.sessionId !== this.#endingSessionId
    );
  }

  /** Step 1 is monotonic and disables local secrets before any final upload. */
  markEnded(sessionId: string | null): Promise<void> {
    if (this.#credentials.sessionId !== sessionId) return Promise.resolve();
    this.#endingSessionId = sessionId;
    return this.update((current) =>
      current.sessionId !== sessionId
        ? current
        : {
            ...current,
            pin: null,
            password: null,
            pinAttempts: 0,
            passwordAttempts: 0,
            status: "ended",
          },
    );
  }

  /** Step 2 follows sync's durable settlement and cannot clear a replacement login. */
  finishEndedSession(sessionId: string | null): Promise<void> {
    return this.update((current) =>
      current.sessionId !== sessionId || current.status === "active" || current.pair === null
        ? current
        : { ...EMPTY_CREDENTIALS, sessionId, status: "ended" },
    );
  }
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  update(change: (current: Credentials) => Credentials): Promise<void> {
    const operation = this.#tail.then(async () => {
      const next = change(this.#credentials);
      if (next === this.#credentials) return;
      await this.#storage.set(ITEM, JSON.stringify(next));
      this.#credentials = next;
      for (const listener of this.#listeners) listener();
    });
    this.#tail = operation.catch(() => {
      // A failed write is reported to its caller; later writes may still recover.
    });
    return operation;
  }

  async clear(): Promise<void> {
    try {
      await this.update(() => EMPTY_CREDENTIALS);
    } catch (error) {
      this.#credentials = EMPTY_CREDENTIALS;
      for (const listener of this.#listeners) listener();
      throw error;
    }
  }
}

function decodeCredentials(saved: string): Credentials {
  const parsed: unknown = JSON.parse(saved);
  const value: unknown =
    typeof parsed === "object" && parsed !== null ? { status: "active", ...parsed } : parsed;
  if (!isCredentials(value)) throw new Error("Invalid secure credentials; refusing to unlock.");
  return value;
}

function isCredentials(value: unknown): value is Credentials {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    isSessionStatus(record.status) &&
    (record.sessionId === null || typeof record.sessionId === "string") &&
    isTokenPair(record.pair) &&
    isVerifier(record.pin) &&
    isVerifier(record.password) &&
    isCounter(record.pinAttempts) &&
    isCounter(record.passwordAttempts)
  );
}

function isTokenPair(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== "object") return false;
  return (
    "access" in value &&
    typeof value.access === "string" &&
    "refresh" in value &&
    typeof value.refresh === "string"
  );
}

function isVerifier(value: unknown): boolean {
  if (value === null) return true;
  if (typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.v === 1 &&
    isCounter(record.iterations) &&
    record.iterations > 0 &&
    isHex(record.salt, 32) &&
    isHex(record.hash, 64)
  );
}

function isHex(value: unknown, length: number): boolean {
  return typeof value === "string" && value.length === length && /^[a-f0-9]+$/.test(value);
}

function isCounter(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isSessionStatus(value: unknown): value is SessionStatus {
  return value === "active" || value === "ended";
}
