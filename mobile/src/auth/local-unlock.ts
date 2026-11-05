import type { CredentialStore, CredentialTransaction } from "./credential-store.ts";
import { EMPTY_CREDENTIALS } from "./credential-store.ts";
import { PASSWORD_ATTEMPT_LIMIT } from "./pin-rules.ts";
import { verifySecret } from "./verifier.ts";
import type { Verifier } from "./verifier.ts";

interface UnlockDeps {
  readonly credentials: CredentialStore;
  readonly getPinLimit: () => number;
  readonly verify?: (secret: string, verifier: Verifier) => Promise<boolean>;
}
interface Attempt {
  readonly sessionId: string | null;
  readonly verifier: Verifier;
  readonly kind: "pin" | "password";
}
export type UnlockResult = (isAccepted: boolean, transaction: CredentialTransaction) => void;

/** Derivation is outside the queue; both write-ahead and the result reducer are inside it. */
export class LocalUnlock {
  readonly #deps: UnlockDeps;
  #isBusy = false;
  constructor(deps: UnlockDeps) {
    this.#deps = deps;
  }

  isPasswordRequired(): boolean {
    const current = this.#deps.credentials.getSnapshot();
    return current.pin === null || current.pinAttempts >= this.#deps.getPinLimit();
  }

  canUseBiometrics(): boolean {
    return (
      this.#deps.credentials.isSessionActive() &&
      this.#deps.credentials.getSnapshot().pin !== null &&
      !this.isPasswordRequired() &&
      !this.#isBusy
    );
  }

  async attempt(secret: string, kind: Attempt["kind"], onResult?: UnlockResult): Promise<boolean> {
    if (this.#isBusy) return false;
    this.#isBusy = true;
    try {
      const attempt = await this.#prepare(kind, onResult);
      if (attempt === null) return false;
      const isCorrect = await (this.#deps.verify ?? verifySecret)(secret, attempt.verifier);
      return await this.#finish(attempt, isCorrect, onResult);
    } finally {
      this.#isBusy = false;
    }
  }

  #prepare(kind: Attempt["kind"], onResult?: UnlockResult): Promise<Attempt | null> {
    return this.#deps.credentials.runExclusive(async (transaction) => {
      const current = transaction.read();
      if (current.status !== "active" || current.pair === null) return null;
      if (kind === "pin" && current.pinAttempts >= this.#deps.getPinLimit()) return null;
      const verifier = current[kind];
      if (verifier === null) return null;
      if (current.passwordAttempts >= PASSWORD_ATTEMPT_LIMIT) {
        await transaction.write(EMPTY_CREDENTIALS);
        onResult?.(false, transaction);
        return null;
      }
      const counter = kind === "pin" ? "pinAttempts" : "passwordAttempts";
      await transaction.write({ ...current, [counter]: current[counter] + 1 });
      return { sessionId: current.sessionId, verifier, kind };
    });
  }

  #finish(attempt: Attempt, isCorrect: boolean, onResult?: UnlockResult): Promise<boolean> {
    return this.#deps.credentials.runExclusive(async (transaction) => {
      const current = transaction.read();
      if (
        current.status !== "active" ||
        current.sessionId !== attempt.sessionId ||
        current[attempt.kind] !== attempt.verifier
      )
        return false;
      const next = isCorrect
        ? { ...current, pinAttempts: 0, passwordAttempts: 0 }
        : current.passwordAttempts >= PASSWORD_ATTEMPT_LIMIT
          ? EMPTY_CREDENTIALS
          : current;
      await transaction.write(next);
      const latest = transaction.read();
      const isAccepted =
        isCorrect && latest.status === "active" && latest.sessionId === attempt.sessionId;
      onResult?.(isAccepted, transaction);
      return isAccepted;
    });
  }
}
