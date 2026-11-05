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

export interface CredentialTransaction {
  readonly read: () => Credentials;
  readonly write: (next: Credentials) => Promise<void>;
  readonly grantUnlock: (expectedGate: number) => boolean;
}

/**
 * One command queue owns credentials and the local unlock flag. Reducers change authoritative
 * memory BEFORE I/O; persistence completion never assigns that memory from an older snapshot.
 * Additions are exposed only after persistence. End/lock conservatively restrict immediately
 * on submission, before their queued persistence; no pending command can undo that restriction.
 */
export class CredentialStore {
  readonly #storage: SecretStorage;
  readonly #listeners = new Set<() => void>();
  readonly #transaction: CredentialTransaction;
  #credentials: Credentials = EMPTY_CREDENTIALS;
  #persisted: Credentials = EMPTY_CREDENTIALS;
  #isUnlocked = false;
  #gate = 0;
  #tail: Promise<unknown> = Promise.resolve();
  #pendingEnd: { sessionId: string | null; journal: (() => Promise<void>) | undefined } | null =
    null;

  constructor(storage: SecretStorage) {
    this.#storage = storage;
    this.#transaction = {
      read: () => this.#credentials,
      write: (next) => this.#write(next),
      grantUnlock: (gate) => this.#grantUnlock(gate),
    };
  }

  load(
    readEnd: (sessionId: string | null) => Promise<boolean> = () => Promise.resolve(false),
  ): Promise<void> {
    return this.runExclusive(async (transaction) => {
      const saved = await this.#storage.get(ITEM);
      this.#credentials = saved === null ? EMPTY_CREDENTIALS : decodeCredentials(saved);
      this.#persisted = this.#credentials;
      this.#isUnlocked = false;
      if (await readEnd(this.#credentials.sessionId)) {
        await transaction.write(endedCredentials(this.#credentials));
      } else if (
        this.#credentials.status === "active" &&
        this.#credentials.passwordAttempts >= PASSWORD_ATTEMPT_LIMIT
      ) {
        await transaction.write(EMPTY_CREDENTIALS);
      }
      this.#emit();
    });
  }

  /** Durable additions, with immediate terminal/erasure restrictions layered over them. */
  getSnapshot = (): Credentials =>
    this.#credentials.status === "ended" || this.#credentials.pair === null
      ? this.#credentials
      : this.#persisted;
  getAccessToken = (): string | undefined =>
    this.isSessionActive() ? this.getSnapshot().pair?.access : undefined;
  hasSyncSession = (): boolean => this.getSnapshot().pair !== null;
  isSessionActive(): boolean {
    const current = this.getSnapshot();
    return current.status === "active" && current.pair !== null;
  }
  isUnlocked(): boolean {
    return this.#isUnlocked;
  }
  unlockGate(): number {
    return this.#gate;
  }

  /** A lock revokes grants, never a pending persisted login or PIN creation. */
  lock(): Promise<void> {
    this.#gate += 1;
    this.#isUnlocked = false;
    const pending = this.runExclusive(() => {
      this.#isUnlocked = false;
      this.#emit();
    });
    this.#emit();
    return pending;
  }

  /** End is visible synchronously, even while another native write/journal is suspended. */
  markEnded(sessionId: string | null, journal?: () => Promise<void>): Promise<void> {
    if (this.#credentials.sessionId !== sessionId) return Promise.resolve();
    if (this.#credentials.status !== "ended") {
      this.#credentials = endedCredentials(this.#credentials);
      this.#gate += 1;
      this.#isUnlocked = false;
    }
    this.#pendingEnd = { sessionId, journal: journal ?? this.#pendingEnd?.journal };
    const pending = this.runExclusive(() => this.#persistEnd());
    // Register persistence before notifying sync; its first POST must await this command.
    this.#emit();
    return pending;
  }

  /** Definitive sync settlement cannot erase a replacement login. */
  finishEndedSession(sessionId: string | null): Promise<void> {
    return this.runExclusive(async (transaction) => {
      const current = transaction.read();
      if (current.sessionId !== sessionId || current.status !== "ended" || current.pair === null)
        return;
      await this.#write({ ...EMPTY_CREDENTIALS, sessionId, status: "ended" }, true);
    });
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  runExclusive<Result>(
    operation: (transaction: CredentialTransaction) => Result | Promise<Result>,
  ): Promise<Result> {
    const pending = this.#tail.then(() => operation(this.#transaction));
    // The caller receives errors. One failed command must not poison future cleanup commands.
    this.#tail = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  async whenSettled(): Promise<void> {
    // This barrier always settles successfully; individual commands still reject to their caller.
    await this.#tail;
    if (this.#pendingEnd !== null) await this.runExclusive(() => this.#persistEnd());
  }

  async #persistEnd(): Promise<void> {
    const end = this.#pendingEnd;
    if (end === null) return;
    try {
      await end.journal?.();
    } finally {
      if (this.#credentials.sessionId === end.sessionId && this.#credentials.status === "ended")
        await this.#write(this.#credentials);
    }
    if (this.#pendingEnd === end) this.#pendingEnd = null;
  }

  update(change: (current: Credentials) => Credentials): Promise<void> {
    return this.runExclusive((transaction) => transaction.write(change(transaction.read())));
  }

  clear(): Promise<void> {
    return this.update(() => EMPTY_CREDENTIALS);
  }

  async #write(next: Credentials, canClearEnded = false): Promise<void> {
    // End dominates every ordinary reducer, including a stale password-exhaustion clear.
    const target = this.#retainedEnd(next, canClearEnded);
    if (target === this.#credentials && target === this.#persisted) return;
    if (target.pair === null && this.#credentials.pair !== null) {
      this.#gate += 1;
      this.#isUnlocked = false;
    }
    this.#credentials = target;
    this.#emit();
    try {
      await this.#storage.set(ITEM, JSON.stringify(target));
    } catch (error) {
      // Restore failed additions only; never undo a concurrent end or an erasure restriction.
      if (this.#credentials === target && target.status === "active" && target.pair !== null) {
        this.#credentials = this.#persisted;
      }
      this.#emit();
      throw error;
    }
    this.#persisted = target;
    this.#emit();
  }

  #retainedEnd(next: Credentials, canClearEnded: boolean): Credentials {
    const current = this.#credentials;
    return !canClearEnded && current.status === "ended" && current.pair !== null ? current : next;
  }

  #grantUnlock(expectedGate: number): boolean {
    if (expectedGate !== this.#gate || !this.isSessionActive()) return false;
    this.#isUnlocked = true;
    this.#emit();
    return true;
  }

  #emit(): void {
    for (const listener of this.#listeners) listener();
  }
}

export function endedCredentials(current: Credentials): Credentials {
  return {
    ...current,
    status: "ended",
    pin: null,
    password: null,
    pinAttempts: 0,
    passwordAttempts: 0,
  };
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
