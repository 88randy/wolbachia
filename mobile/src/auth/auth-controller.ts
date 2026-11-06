import type { Schemas } from "@wolbachia/api-client";

import { toHex } from "../db/encrypted-database.ts";
import type { KvStore } from "../db/kv-store.ts";
import { endedCredentials } from "./credential-store.ts";
import type { CredentialStore, Credentials } from "./credential-store.ts";
import { readAuthRules, hasClockSkew } from "./auth-rules.ts";
import { deriveAuthSnapshot } from "./auth-state.ts";
import type { AuthContext, AuthProfile, AuthSnapshot } from "./auth-state.ts";
import type { LoginResult } from "./auth-api.ts";
import { canLoginAs } from "./login-policy.ts";
import { LocalUnlock } from "./local-unlock.ts";
import { isAllowedPin } from "./pin-rules.ts";
import { isRulesSnapshot } from "./rules-snapshot.ts";
import { SESSION_ENDED_KEY, readEndedSession } from "./session-journal.ts";
import { createVerifier, PASSWORD_ITERATIONS, PIN_ITERATIONS } from "./verifier.ts";
import type { Verifier } from "./verifier.ts";

export type { AuthSnapshot } from "./auth-state.ts";
const PROFILE_KEY = "session_profile";
const RULES_KEY = "auth_rules_snapshot";

interface AuthDeps {
  readonly credentials: CredentialStore;
  readonly kv: Pick<KvStore, "get" | "set">;
  readonly hasLocalRecords: () => Promise<boolean>;
  readonly prepareEvidenceSession?: (
    input: Pick<AcceptedLogin, "profile" | "credentials">,
  ) => Promise<boolean>;
  readonly login: (username: string, password: string) => Promise<LoginResult>;
  readonly fetchRules: () => Promise<unknown>;
  readonly randomBytes: (length: number) => Uint8Array;
  readonly now: () => number;
  readonly clearSessionData?: (hasFinalReceipt?: boolean) => Promise<void>;
  readonly verify?: (secret: string, verifier: Verifier) => Promise<boolean>;
}
interface AcceptedLogin {
  readonly credentials: Credentials;
  readonly profile: AuthProfile;
  readonly gate: number;
  readonly time: { serverTime: string; phoneTime: number };
}

/** One credential queue owns auth transitions; the UI is a projection, never another state machine. */
export class AuthController {
  readonly #deps: AuthDeps;
  readonly #listeners = new Set<() => void>();
  readonly #unlock: LocalUnlock;
  #isBusy = false;
  #isSessionDataPending = false;
  #isUnlocking = false;
  #sessionDataClear: Promise<void> | null = null;
  #context: AuthContext = {
    profile: null,
    rules: readAuthRules(null),
    notice: null,
    hasClockSkew: false,
    isOnline: false,
  };
  #snapshot: AuthSnapshot;

  constructor(deps: AuthDeps) {
    this.#deps = deps;
    this.#unlock = new LocalUnlock({
      credentials: deps.credentials,
      getPinLimit: () => this.#context.rules.pinMaxAttempts,
      ...(deps.verify === undefined ? {} : { verify: deps.verify }),
    });
    this.#snapshot = this.#deriveSnapshot();
    deps.credentials.subscribe(() => {
      this.#refreshSnapshot();
    });
  }

  getSnapshot = (): AuthSnapshot => this.#snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  load(): Promise<void> {
    if (!this.#deps.credentials.isSessionActive()) this.#isSessionDataPending = true;
    return this.#deps.credentials
      .runExclusive(async (transaction) => {
        const profile = await this.#deps.kv.get(PROFILE_KEY);
        const rules = await this.#deps.kv.get(RULES_KEY);
        const parsed: unknown = rules === null ? null : JSON.parse(rules);
        const current = transaction.read();
        if (
          current.status === "active" &&
          (await readEndedSession(this.#deps.kv, current.sessionId))
        )
          await transaction.write(endedCredentials(transaction.read()));
        this.#publish({
          profile: profile === null ? null : (JSON.parse(profile) as AuthProfile),
          rules: readAuthRules(isRulesSnapshot(parsed) ? parsed : null),
        });
      })
      .then(() => this.#restoreSessionData());
  }

  async #restoreSessionData(): Promise<void> {
    if (!this.#deps.credentials.isSessionActive()) this.#isSessionDataPending = true;
    try {
      await this.retrySessionDataCleanup();
    } catch {
      // Cleanup already published its error. Boot keeps the fenced P1 retry action usable.
      this.#refreshSnapshot();
    }
  }

  /** Joins cleanup already in flight; retries a failed clear without replaying auth or captured work. */
  retrySessionDataCleanup = (): Promise<void> => {
    if (!this.#isSessionDataPending || this.#isUnlocking) return Promise.resolve();
    if (this.#sessionDataClear !== null) return this.#sessionDataClear;
    const current = this.#deps.credentials.getSnapshot();
    const attempt = Promise.resolve()
      .then(() => this.#clearSessionData(current))
      .finally(() => {
        if (this.#sessionDataClear === attempt) this.#sessionDataClear = null;
      });
    this.#sessionDataClear = attempt;
    return attempt;
  };

  async #clearSessionData(expected: Credentials): Promise<void> {
    try {
      await this.#deps.clearSessionData?.();
      if (!sameSessionContext(expected, this.#deps.credentials.getSnapshot()))
        throw new Error("Session changed during local data cleanup.");
      this.#isSessionDataPending = false;
      this.#publish({
        notice:
          this.#context.notice?.key === "mobile.login.cleanupFailed" ? null : this.#context.notice,
      });
    } catch (error) {
      this.#publish({ notice: { key: "mobile.login.cleanupFailed" } });
      throw error;
    }
  }

  /** Connectivity is an external input; it cannot mutate credentials or the derived UI phase. */
  setOnline(isOnline: boolean): void {
    this.#publish({ isOnline });
  }
  lock(): Promise<void> {
    return this.#deps.credentials.lock();
  }

  endSession(hasFinalReceipt = false): Promise<void> {
    const sessionId = this.#deps.credentials.getSnapshot().sessionId;
    return this.#deps.credentials.markEnded(sessionId, async () => {
      this.#publish({ notice: null });
      await this.#deps.kv.set(SESSION_ENDED_KEY, JSON.stringify({ sessionId, status: "ended" }));
      await this.#deps.clearSessionData?.(hasFinalReceipt);
    });
  }

  canLogin(): boolean {
    return (
      !this.#isSessionDataPending &&
      this.#snapshot.phase === "login" &&
      !this.#deps.credentials.hasSyncSession()
    );
  }

  async login(username: string, password: string): Promise<void> {
    if (this.#isBusy || !this.canLogin()) return;
    this.#isBusy = true;
    const gate = this.#deps.credentials.unlockGate();
    try {
      await this.#deps.credentials.runExclusive((transaction) => {
        transaction.setLoginInFlight(true);
      });
      await this.#login(username.trim(), password, gate);
    } finally {
      await this.#deps.credentials.runExclusive((transaction) => {
        transaction.setLoginInFlight(false);
      });
      this.#isBusy = false;
    }
  }

  async #login(username: string, password: string, gate: number): Promise<void> {
    const refused = await this.#deps.credentials.runExclusive(async () => {
      if (!this.#context.isOnline) {
        this.#publish({ notice: { key: "mobile.login.noSignal" } });
        return true;
      }
      const hasRecords = await this.#deps.hasLocalRecords();
      if (canLoginAs(username, this.#context.profile?.username ?? null, hasRecords)) return false;
      this.#publish({ notice: { key: "mobile.login.differentUser" } });
      return true;
    });
    if (refused) return;
    const answer = await this.#deps.login(username, password);
    if (!answer.ok) {
      await this.#deps.credentials.runExclusive(() => {
        this.#publish({ notice: answer.notice });
      });
      return;
    }
    const time = { serverTime: answer.login.server_time, phoneTime: this.#deps.now() };
    await this.#acceptLogin(answer.login, password, { gate, time, origin: answer.origin });
  }

  async #acceptLogin(
    login: Schemas["MobileLoginResponse"],
    password: string,
    attempt: { gate: number; time: AcceptedLogin["time"]; origin: string },
  ): Promise<void> {
    const verifier = await createVerifier(password, PASSWORD_ITERATIONS, this.#deps.randomBytes);
    const sessionId = toHex(this.#deps.randomBytes(16));
    const accepted: AcceptedLogin = {
      ...attempt,
      profile: { ...profileOf(login.me), sessionId, issuer: attempt.origin },
      credentials: {
        status: "active",
        origin: attempt.origin,
        sessionId,
        pair: { access: login.access, refresh: login.refresh },
        password: verifier,
        pin: null,
        pinAttempts: 0,
        passwordAttempts: 0,
      },
    };
    if (!(await this.#persistLogin(accepted))) return;
    // Optional policy fetch never holds the queue or blocks PIN setup.
    void this.#finishLogin(accepted);
  }

  #persistLogin(accepted: AcceptedLogin): Promise<boolean> {
    return this.#deps.credentials.runExclusive(async (transaction) => {
      if ((await this.#deps.prepareEvidenceSession?.(accepted)) === false) {
        this.#publish({ notice: { key: "mobile.login.differentUser" } });
        return false;
      }
      await this.#deps.kv.set(PROFILE_KEY, JSON.stringify(accepted.profile));
      await this.#deps.kv.set(RULES_KEY, JSON.stringify(null));
      await this.#deps.kv.set(SESSION_ENDED_KEY, "false");
      this.#publish({
        profile: accepted.profile,
        rules: readAuthRules(null),
        notice: null,
        hasClockSkew: hasClockSkew(
          accepted.time.serverTime,
          accepted.time.phoneTime,
          readAuthRules(null).clockSkewReviewSeconds,
        ),
      });
      await transaction.write(accepted.credentials);
      // A lock only drops this grant. It never cancels the accepted persisted credentials.
      transaction.grantUnlock(accepted.gate);
      return true;
    });
  }

  async #finishLogin(accepted: AcceptedLogin): Promise<void> {
    try {
      const snapshot = await this.#deps.fetchRules();
      if (!isRulesSnapshot(snapshot)) return;
      await this.#deps.credentials.runExclusive(async (transaction) => {
        if (!isCurrentSession(transaction.read(), accepted.credentials.sessionId)) return;
        await this.#deps.kv.set(RULES_KEY, JSON.stringify(snapshot));
        if (!isCurrentSession(transaction.read(), accepted.credentials.sessionId)) return;
        const rules = readAuthRules(snapshot);
        this.#publish({
          rules,
          hasClockSkew: hasClockSkew(
            accepted.time.serverTime,
            accepted.time.phoneTime,
            rules.clockSkewReviewSeconds,
          ),
        });
      });
    } catch {
      // Fetching optional policy failed: the accepted session keeps its already-published defaults.
      await this.#deps.credentials.runExclusive(() => {
        if (isCurrentSession(this.#deps.credentials.getSnapshot(), accepted.credentials.sessionId))
          this.#refreshSnapshot();
      });
    }
  }

  async createPin(pin: string): Promise<boolean> {
    if (this.#snapshot.phase !== "createPin" || !isAllowedPin(pin) || this.#isBusy) return false;
    this.#isBusy = true;
    const sessionId = this.#deps.credentials.getSnapshot().sessionId;
    const gate = this.#deps.credentials.unlockGate();
    try {
      const verifier = await createVerifier(pin, PIN_ITERATIONS, this.#deps.randomBytes);
      return await this.#deps.credentials.runExclusive(async (transaction) => {
        const current = transaction.read();
        if (!isCurrentSession(current, sessionId) || current.pin !== null) return false;
        await transaction.write({ ...current, pin: verifier, pinAttempts: 0 });
        transaction.grantUnlock(gate);
        this.#publish({ notice: null });
        return true;
      });
    } finally {
      this.#isBusy = false;
    }
  }

  unlock(secret: string, kind: "pin" | "password"): Promise<void> {
    if (this.#snapshot.phase !== "locked" || this.#isSessionDataPending) return Promise.resolve();
    // Guard before credential writes can publish pair=null. A replacement login must await cleanup.
    this.#isSessionDataPending = true;
    this.#isUnlocking = true;
    const gate = this.#deps.credentials.unlockGate();
    return this.#unlock
      .attempt(secret, kind, (isAccepted, transaction) => {
        const current = transaction.read();
        if (current.status === "ended") return;
        if (current.pair === null) {
          this.#publish({ notice: { key: "mobile.login.onlineRequired" } });
          return;
        }
        if (isAccepted) {
          transaction.grantUnlock(gate);
          this.#publish({ notice: null });
        } else this.#publish({ notice: { key: "mobile.unlock.wrongSecret" } });
      })
      .finally(async () => {
        this.#isUnlocking = false;
        if (!this.#deps.credentials.isSessionActive()) return this.retrySessionDataCleanup();
        this.#isSessionDataPending = false;
        this.#refreshSnapshot();
      })
      .then(() => undefined);
  }

  canUseBiometrics(): boolean {
    return (
      !this.#isSessionDataPending &&
      this.#snapshot.phase === "locked" &&
      this.#unlock.canUseBiometrics()
    );
  }
  biometricGate(): number {
    return this.#deps.credentials.unlockGate();
  }
  unlockBiometric(gate: number): Promise<void> {
    return this.#deps.credentials.runExclusive((transaction) => {
      if (!this.canUseBiometrics()) return;
      if (transaction.grantUnlock(gate)) this.#publish({ notice: null });
    });
  }

  #deriveSnapshot(): AuthSnapshot {
    const snapshot = deriveAuthSnapshot({
      credentials: this.#deps.credentials.getSnapshot(),
      isUnlocked: this.#deps.credentials.isUnlocked() && !this.#isSessionDataPending,
      context: this.#context,
    });
    return this.#context.notice?.key === "mobile.login.cleanupFailed"
      ? { ...snapshot, notice: this.#context.notice }
      : snapshot;
  }
  #publish(patch: Partial<AuthContext>): void {
    this.#context = { ...this.#context, ...patch };
    this.#refreshSnapshot();
  }
  #refreshSnapshot(): void {
    this.#snapshot = this.#deriveSnapshot();
    for (const listener of this.#listeners) listener();
  }
}

function profileOf(me: Schemas["Me"]): AuthProfile {
  return {
    userId: me.user.id,
    username: me.user.username,
    firstName: me.user.first_name,
    organization: me.organization,
    permissions: me.permissions,
  };
}
function isCurrentSession(current: Credentials, sessionId: string | null): boolean {
  return current.status === "active" && current.sessionId === sessionId && current.pair !== null;
}

function sameSessionContext(previous: Credentials, current: Credentials): boolean {
  return (
    previous.sessionId === current.sessionId &&
    previous.origin === current.origin &&
    previous.status === current.status
  );
}
