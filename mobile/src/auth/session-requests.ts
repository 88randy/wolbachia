import { isErrorEnvelope } from "@wolbachia/api-client";

import type { CredentialStore, TokenPair } from "./credential-store.ts";

export interface ApiAnswer {
  readonly response: Response;
  readonly error?: unknown;
}
interface SessionRequestDeps {
  readonly credentials: CredentialStore;
  readonly isOnline: () => boolean;
  readonly refresh: (pair: TokenPair) => Promise<TokenPair>;
  readonly endSession: () => Promise<void>;
}

export class RemoteSessionEnded extends Error {}

export function isSessionEnded(code: string): boolean {
  return ["session_revoked", "invalid_token", "device_revoked", "refresh_reuse"].includes(code);
}

export function errorCode(answer: ApiAnswer): string {
  return isErrorEnvelope(answer.error) ? answer.error.code : "";
}

/**
 * One in-flight refresh, shared by concurrent requests. Compare the pair before refreshing:
 * a late 401 for an old access retries with the already persisted replacement.
 */
export class SessionRequests {
  readonly #deps: SessionRequestDeps;
  #inFlight: Promise<void> | null = null;
  #inFlightPair: TokenPair | null = null;
  constructor(deps: SessionRequestDeps) {
    this.#deps = deps;
  }

  async run<Answer extends ApiAnswer>(call: () => Promise<Answer>): Promise<Answer> {
    const { pair, sessionId } = this.#deps.credentials.getSnapshot();
    let answer = await call();
    if (this.#deps.credentials.getSnapshot().sessionId !== sessionId) return answer;
    if (answer.response.status === 401 && errorCode(answer) === "token_expired" && pair !== null) {
      if (!this.#deps.isOnline()) return answer;
      await this.refresh(pair);
      const current = this.#deps.credentials.getSnapshot();
      if (current.pair === null || current.sessionId !== sessionId) return answer;
      answer = await call();
    }
    if (
      isSessionEnded(errorCode(answer)) &&
      this.#deps.credentials.getSnapshot().sessionId === sessionId
    ) {
      await this.#deps.endSession();
    }
    return answer;
  }

  refresh(pair: TokenPair): Promise<void> {
    if (this.#deps.credentials.getSnapshot().pair !== pair) return Promise.resolve();
    if (this.#inFlight !== null && this.#inFlightPair === pair) return this.#inFlight;
    const shared = this.#refreshAndPersist(pair).finally(() => {
      if (this.#inFlight === shared) this.#inFlight = null;
    });
    this.#inFlightPair = pair;
    this.#inFlight = shared;
    return shared;
  }

  async #requestRefresh(pair: TokenPair): Promise<TokenPair> {
    try {
      return await this.#deps.refresh(pair);
    } catch (error) {
      if (
        error instanceof RemoteSessionEnded &&
        this.#deps.credentials.getSnapshot().pair === pair
      ) {
        await this.#deps.endSession();
      }
      throw error;
    }
  }

  async #refreshAndPersist(pair: TokenPair): Promise<void> {
    if (this.#deps.credentials.getSnapshot().pair !== pair) return;
    const next = await this.#requestRefresh(pair);
    await this.#deps.credentials.update((current) =>
      current.pair === pair ? { ...current, pair: next } : current,
    );
  }
}
