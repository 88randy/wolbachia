import type { CredentialStore } from "./credential-store.ts";
import { EMPTY_CREDENTIALS } from "./credential-store.ts";
import { PASSWORD_ATTEMPT_LIMIT } from "./pin-rules.ts";
import { verifySecret } from "./verifier.ts";
import type { Verifier } from "./verifier.ts";

interface UnlockDeps {
  readonly credentials: CredentialStore;
  readonly getPinLimit: () => number;
  readonly verify?: (secret: string, verifier: Verifier) => Promise<boolean>;
}

/** No outbox dependency: exhausting attempts can clear credentials only. */
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
    const current = this.#deps.credentials.getSnapshot();
    return (
      current.pair !== null && current.pin !== null && !this.isPasswordRequired() && !this.#isBusy
    );
  }

  /** Count BEFORE deriving, including an interrupted attempt. A concurrent tap cannot race it. */
  async attempt(secret: string, kind: "pin" | "password"): Promise<boolean> {
    if (this.#isBusy || (kind === "pin" && this.isPasswordRequired())) return false;
    this.#isBusy = true;
    try {
      if (this.#deps.credentials.getSnapshot().passwordAttempts >= PASSWORD_ATTEMPT_LIMIT) {
        await this.#deps.credentials.clear();
        return false;
      }
      return await this.#verifyAttempt(secret, kind);
    } finally {
      this.#isBusy = false;
    }
  }

  async #verifyAttempt(secret: string, kind: "pin" | "password"): Promise<boolean> {
    const store = this.#deps.credentials;
    const before = store.getSnapshot();
    const verifier = before[kind];
    if (verifier === null || before.pair === null) return false;
    const counter = kind === "pin" ? "pinAttempts" : "passwordAttempts";
    await store.update((current) =>
      current.sessionId !== before.sessionId
        ? current
        : { ...current, [counter]: current[counter] + 1 },
    );
    const isCorrect = await (this.#deps.verify ?? verifySecret)(secret, verifier);
    let isAccepted = false;
    await store.update((current) => {
      if (current.sessionId !== before.sessionId || current[kind] !== verifier) return current;
      isAccepted = isCorrect;
      if (isCorrect) return { ...current, pinAttempts: 0, passwordAttempts: 0 };
      return current.passwordAttempts >= PASSWORD_ATTEMPT_LIMIT ? EMPTY_CREDENTIALS : current;
    });
    return isAccepted;
  }
}
