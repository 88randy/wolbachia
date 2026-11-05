import { isErrorEnvelope } from "@wolbachia/api-client";

import type { CredentialStore, Credentials, TokenPair } from "./credential-store.ts";

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
export interface SyncAnswer<Answer> {
  readonly answer: Answer;
  /** Sync owns this callback: apply/settle its batch durably BEFORE calling it. */
  readonly completeSession?: () => Promise<void>;
}

export class RemoteSessionEnded extends Error {}

export function isSessionEnded(code: string): boolean {
  return ["session_revoked", "invalid_token", "device_revoked", "refresh_reuse"].includes(code);
}
export function errorCode(answer: ApiAnswer): string {
  return isErrorEnvelope(answer.error) ? answer.error.code : "";
}
function isFinalUpload(answer: ApiAnswer): boolean {
  return answer.response.ok && answer.response.headers.get("X-Session-Revoked") === "true";
}

function hasEndedResponse(answer: ApiAnswer, isSync: boolean): boolean {
  return isSessionEnded(errorCode(answer)) || (isSync && isFinalUpload(answer));
}

function isDefinitiveSyncAnswer(answer: ApiAnswer): boolean {
  return answer.response.ok || answer.response.status === 401 || answer.response.status === 403;
}

/**
 * Monotonic session end: active -> ended -> erased on a definitive sync answer.
 * Sync retries the retained pair through the normal failure table; only the server spends it.
 * Successful completion belongs AFTER the batch transaction.
 * Refresh remains single-flight and is permanently forbidden once end begins for that session.
 */
export class SessionRequests {
  readonly #deps: SessionRequestDeps;
  #inFlight: Promise<void> | null = null;
  #inFlightPair: TokenPair | null = null;
  #endedSessionId: string | null = null;
  #ending: { sessionId: string | null; promise: Promise<void> } | null = null;

  constructor(deps: SessionRequestDeps) {
    this.#deps = deps;
  }

  run<Answer extends ApiAnswer>(call: () => Promise<Answer>): Promise<Answer> {
    return this.#runActive(call, false);
  }

  async runSync<Answer extends ApiAnswer>(
    call: (access: string) => Promise<Answer>,
  ): Promise<SyncAnswer<Answer>> {
    if (this.#ending?.sessionId === this.#deps.credentials.getSnapshot().sessionId)
      await this.#ending.promise;
    const session = this.#deps.credentials.getSnapshot();
    const pair = session.pair;
    if (pair === null) throw new RemoteSessionEnded();
    if (session.status !== "active") return this.#runFinal(call, session);
    try {
      const answer = await this.#runActive(
        () => call(this.#deps.credentials.getAccessToken() ?? pair.access),
        true,
      );
      return this.#syncAnswer(answer, session);
    } catch (error) {
      if (!(error instanceof RemoteSessionEnded) || !this.#belongsTo(session)) throw error;
      return this.#runFinal(call, session);
    }
  }

  async #runActive<Answer extends ApiAnswer>(
    call: () => Promise<Answer>,
    isSync: boolean,
  ): Promise<Answer> {
    const session = this.#deps.credentials.getSnapshot();
    this.#requireActive(session);
    let answer = await call();
    if (!this.#belongsTo(session)) return answer;
    if (
      answer.response.status === 401 &&
      errorCode(answer) === "token_expired" &&
      session.pair !== null
    ) {
      if (!this.#deps.isOnline()) return answer;
      await this.refresh(session.pair);
      if (!this.#belongsTo(session) || !this.#deps.credentials.isSessionActive()) return answer;
      answer = await call();
    }
    if (this.#belongsTo(session) && hasEndedResponse(answer, isSync)) {
      await this.#beginEnd(session.sessionId);
    }
    return answer;
  }

  async #runFinal<Answer extends ApiAnswer>(
    call: (access: string) => Promise<Answer>,
    session: Credentials,
  ): Promise<SyncAnswer<Answer>> {
    if (!this.#belongsTo(session) || !this.#deps.isOnline()) throw new RemoteSessionEnded();
    const current = this.#deps.credentials.getSnapshot();
    if (current.pair === null) throw new RemoteSessionEnded();
    return this.#syncAnswer(await call(current.pair.access), session);
  }

  #syncAnswer<Answer extends ApiAnswer>(answer: Answer, session: Credentials): SyncAnswer<Answer> {
    const current = this.#deps.credentials.getSnapshot();
    if (!this.#belongsTo(session) || current.status !== "ended" || !isDefinitiveSyncAnswer(answer))
      return { answer };
    return {
      answer,
      completeSession: () => this.#deps.credentials.finishEndedSession(session.sessionId),
    };
  }

  #belongsTo(session: Credentials): boolean {
    return this.#deps.credentials.getSnapshot().sessionId === session.sessionId;
  }

  #requireActive(session: Credentials): void {
    if (!this.#deps.credentials.isSessionActive() || this.#endedSessionId === session.sessionId) {
      throw new RemoteSessionEnded();
    }
  }

  #beginEnd(sessionId: string | null): Promise<void> {
    if (this.#deps.credentials.getSnapshot().sessionId !== sessionId) return Promise.resolve();
    this.#endedSessionId = sessionId;
    const previous =
      this.#ending?.sessionId === sessionId ? this.#ending.promise : Promise.resolve();
    const promise = previous.then(async () => {
      if (this.#deps.credentials.getSnapshot().sessionId === sessionId)
        await this.#deps.endSession();
    });
    this.#ending = { sessionId, promise };
    return promise;
  }

  refresh(pair: TokenPair): Promise<void> {
    const current = this.#deps.credentials.getSnapshot();
    if (!this.#deps.credentials.isSessionActive() || this.#endedSessionId === current.sessionId) {
      return Promise.reject(new RemoteSessionEnded());
    }
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
        await this.#beginEnd(this.#deps.credentials.getSnapshot().sessionId);
      }
      throw error;
    }
  }

  async #refreshAndPersist(pair: TokenPair): Promise<void> {
    if (this.#deps.credentials.getSnapshot().pair !== pair) return;
    const next = await this.#requestRefresh(pair);
    await this.#deps.credentials.update((current) =>
      current.pair === pair && current.status === "active" ? { ...current, pair: next } : current,
    );
  }
}
