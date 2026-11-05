import type { Schemas } from "@wolbachia/api-client";

import { PASSWORD_ATTEMPT_LIMIT } from "./pin-rules.ts";
import { isRecord, isTokenPair } from "./auth-response.ts";
import { parseApiBaseUrl } from "../config/api-base-url.ts";
import type { SecretStorage } from "./secret-storage.ts";
import type { Verifier } from "./verifier.ts";

export type TokenPair = Pick<Schemas["RefreshResponse"], "access" | "refresh">;
export type SessionStatus = "active" | "ended";
export interface Credentials {
  readonly status: SessionStatus;
  readonly origin: string | null;
  readonly sessionId: string | null;
  readonly pair: TokenPair | null;
  readonly pin: Verifier | null;
  readonly password: Verifier | null;
  readonly pinAttempts: number;
  readonly passwordAttempts: number;
}
export const EMPTY_CREDENTIALS: Credentials = {
  status: "active",
  origin: null,
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
  readonly setLoginInFlight: (isInFlight: boolean) => void;
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
  #isLoginInFlight = false;
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
      setLoginInFlight: (isInFlight) => {
        this.#isLoginInFlight = isInFlight;
        this.#emit();
      },
    };
  }

  load(
    readEnd: (sessionId: string | null) => Promise<boolean> = () => Promise.resolve(false),
    legacyOrigin: string | null = null,
  ): Promise<void> {
    return this.runExclusive(async (transaction) => {
      const saved = await this.#storage.get(ITEM);
      const decoded =
        saved === null
          ? { credentials: EMPTY_CREDENTIALS, needsMigration: false }
          : decodeCredentials(saved, legacyOrigin);
      this.#credentials = decoded.credentials;
      this.#persisted = decoded.needsMigration ? EMPTY_CREDENTIALS : this.#credentials;
      this.#isUnlocked = false;
      if (await readEnd(this.#credentials.sessionId)) {
        await transaction.write(endedCredentials(this.#credentials));
      } else if (
        this.#credentials.status === "active" &&
        this.#credentials.passwordAttempts >= PASSWORD_ATTEMPT_LIMIT
      ) {
        await transaction.write(EMPTY_CREDENTIALS);
      } else if (decoded.needsMigration && this.#credentials.pair !== null) {
        await transaction.write({ ...this.#credentials });
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
  getOrigin = (): string | null => this.getSnapshot().origin;
  hasSyncSession = (): boolean => this.getSnapshot().pair !== null;
  /** Level source for the worker: reconcile queued end writes, then read only durable state. */
  hasPendingFinalUpload = async (): Promise<boolean> => {
    await this.whenSettled();
    return this.#persisted.status === "ended" && this.#persisted.pair !== null;
  };
  isLoginInFlight(): boolean {
    return this.#isLoginInFlight;
  }
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
    // An ended session's pair (for example a rotated successor) whose write was refused stays in
    // memory only: persist it before any final upload relies on it.
    if (this.#hasUnsavedEndedPair()) {
      await this.runExclusive(async () => {
        if (this.#hasUnsavedEndedPair()) await this.#write(this.#credentials, true);
      });
    }
  }

  #hasUnsavedEndedPair(): boolean {
    const current = this.#credentials;
    return current !== this.#persisted && current.status === "ended" && current.pair !== null;
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

  /**
   * The server rotated `previous` into `next`: keep the successor even if the session ended
   * meanwhile. A revoked session's final upload is accepted only for its current pair, and the old
   * one stops working when the rotation grace window closes. Status and erased verifiers are kept.
   */
  replaceRotatedPair(previous: TokenPair, next: TokenPair): Promise<void> {
    return this.runExclusive(async () => {
      if (this.#credentials.pair !== previous) return;
      await this.#write({ ...this.#credentials, pair: next }, true);
    });
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

function decodeCredentials(saved: string, legacyOrigin: string | null) {
  try {
    const parsed: unknown = JSON.parse(saved);
    if (!isRecord(parsed)) return { credentials: EMPTY_CREDENTIALS, needsMigration: false };
    const needsMigration = !("origin" in parsed) && parsed.pair !== null;
    const value = {
      status: "active",
      origin: null,
      ...parsed,
      ...(needsMigration ? { origin: legacyOrigin } : {}),
    };
    return { credentials: isCredentials(value) ? value : EMPTY_CREDENTIALS, needsMigration };
  } catch {
    // An unusable secret is isolated from local evidence: require login, never erase the database.
    return { credentials: EMPTY_CREDENTIALS, needsMigration: false };
  }
}

function isCredentials(
  value: Record<string, unknown>,
): value is Record<string, unknown> & Credentials {
  return (
    isSessionIdentity(value) &&
    isVerifier(value.pin) &&
    isVerifier(value.password) &&
    isCounter(value.pinAttempts) &&
    isCounter(value.passwordAttempts)
  );
}
function isOrigin(value: unknown): value is string {
  return typeof value === "string" && parseApiBaseUrl(value, true).ok;
}
function isSessionIdentity(record: Record<string, unknown>): boolean {
  return (
    isSessionStatus(record.status) &&
    (record.sessionId === null || typeof record.sessionId === "string") &&
    (record.origin === null || isOrigin(record.origin)) &&
    (record.pair === null || (isTokenPair(record.pair) && isOrigin(record.origin)))
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
