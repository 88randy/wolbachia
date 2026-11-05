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
  /** An active POST completed after end: apply it normally, then make an actual final POST. */
  readonly needsFinalUpload?: boolean;
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
    await this.#deps.credentials.whenSettled();
    const session = this.#deps.credentials.getSnapshot();
    const pair = session.pair;
    if (pair === null) throw new RemoteSessionEnded();
    if (session.status !== "active") return this.#runFinal(call, session);
    let sent = session;
    const send = () => {
      sent = this.#deps.credentials.getSnapshot();
      return call(sent.pair?.access ?? pair.access);
    };
    try {
      const answer = await this.#runActive(send, true);
      return this.#syncAnswer(answer, sent);
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
    this.#requireActive();
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
    await this.#deps.credentials.whenSettled();
    if (!this.#belongsTo(session) || !this.#deps.isOnline()) throw new RemoteSessionEnded();
    const current = this.#deps.credentials.getSnapshot();
    if (current.pair === null) throw new RemoteSessionEnded();
    return this.#syncAnswer(await call(current.pair.access), current);
  }

  #syncAnswer<Answer extends ApiAnswer>(answer: Answer, session: Credentials): SyncAnswer<Answer> {
    const current = this.#deps.credentials.getSnapshot();
    if (!this.#belongsTo(session) || current.status !== "ended" || !isDefinitiveSyncAnswer(answer))
      return { answer };
    // Provenance belongs to this POST, never to the state at response time.
    if (session.status !== "ended" && !isFinalUpload(answer))
      return { answer, needsFinalUpload: true };
    return {
      answer,
      completeSession: () => this.#deps.credentials.finishEndedSession(session.sessionId),
    };
  }

  #belongsTo(session: Credentials): boolean {
    return this.#deps.credentials.getSnapshot().sessionId === session.sessionId;
  }

  #requireActive(): void {
    if (!this.#deps.credentials.isSessionActive()) {
      throw new RemoteSessionEnded();
    }
  }

  #beginEnd(sessionId: string | null): Promise<void> {
    if (this.#deps.credentials.getSnapshot().sessionId !== sessionId) return Promise.resolve();
    if (this.#ending?.sessionId === sessionId) return this.#ending.promise;
    const promise = this.#deps.endSession().finally(() => {
      if (this.#ending?.promise === promise) this.#ending = null;
    });
    this.#ending = { sessionId, promise };
    return promise;
  }

  refresh(pair: TokenPair): Promise<void> {
    if (!this.#deps.credentials.isSessionActive()) {
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
