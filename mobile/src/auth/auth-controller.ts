import type { Schemas } from "@wolbachia/api-client";

import { toHex } from "../db/encrypted-database.ts";
import type { KvStore } from "../db/kv-store.ts";
import type { OutboxRepository } from "../outbox/outbox-repository.ts";
import type { CredentialStore } from "./credential-store.ts";
import { readAuthRules, hasClockSkew } from "./auth-rules.ts";
import type { AuthRules } from "./auth-rules.ts";
import type { LoginResult } from "./auth-api.ts";
import type { Verifier } from "./verifier.ts";
import type { LoginNotice } from "./login-error.ts";
import { canLoginAs } from "./login-policy.ts";
import { LocalUnlock } from "./local-unlock.ts";
import { isAllowedPin } from "./pin-rules.ts";
import { isRulesSnapshot } from "./rules-snapshot.ts";
import { createVerifier, PASSWORD_ITERATIONS, PIN_ITERATIONS } from "./verifier.ts";

const PROFILE_KEY = "session_profile";
const RULES_KEY = "auth_rules_snapshot";
const ENDED_KEY = "session_ended";
type Profile = {
  readonly username: string;
  readonly firstName: string;
  readonly organization: Schemas["Me"]["organization"];
  readonly permissions: Schemas["Me"]["permissions"];
};
export interface AuthSnapshot {
  readonly phase: "login" | "createPin" | "locked" | "unlocked";
  readonly profile: Profile | null;
  readonly rules: AuthRules;
  readonly notice: LoginNotice | null;
  readonly hasClockSkew: boolean;
  readonly isOnline: boolean;
  readonly isPasswordRequired: boolean;
  readonly isPinSetupRequired: boolean;
  readonly remainingAttempts: number;
}
interface AuthDeps {
  readonly credentials: CredentialStore;
  readonly kv: Pick<KvStore, "get" | "set">;
  readonly outbox: Pick<OutboxRepository, "countByStatus">;
  readonly login: (username: string, password: string) => Promise<LoginResult>;
  readonly fetchRules: () => Promise<unknown>;
  readonly randomBytes: (length: number) => Uint8Array;
  readonly now: () => number;
}

/** Local UI gate. Locking never unmounts navigation and never touches captured work. */
export class AuthController {
  readonly #deps: AuthDeps;
  readonly #listeners = new Set<() => void>();
  readonly #unlock: LocalUnlock;
  #gate = 0;
  #isBusy = false;
  #snapshot: AuthSnapshot = {
    phase: "login",
    profile: null,
    rules: readAuthRules(null),
    notice: null,
    hasClockSkew: false,
    isOnline: false,
    isPasswordRequired: false,
    isPinSetupRequired: false,
    remainingAttempts: readAuthRules(null).pinMaxAttempts,
  };

  constructor(deps: AuthDeps) {
    this.#deps = deps;
    this.#unlock = new LocalUnlock({
      credentials: deps.credentials,
      getPinLimit: () => this.#snapshot.rules.pinMaxAttempts,
    });
  }

  getSnapshot = (): AuthSnapshot => this.#snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  async load(): Promise<void> {
    const hasEnded = (await this.#deps.kv.get(ENDED_KEY)) === "true";
    if (hasEnded) await this.#deps.credentials.clear();
    const profile = await this.#deps.kv.get(PROFILE_KEY);
    const rules = await this.#deps.kv.get(RULES_KEY);
    const parsed: unknown = rules === null ? null : JSON.parse(rules);
    this.#publish({
      profile: profile === null ? null : (JSON.parse(profile) as Profile),
      rules: readAuthRules(isRulesSnapshot(parsed) ? parsed : null),
      phase: this.#deps.credentials.getSnapshot().pair === null ? "login" : "locked",
      notice: hasEnded ? { key: "mobile.login.sessionEnded" } : null,
    });
  }

  setOnline(isOnline: boolean): void {
    this.#publish({ isOnline });
  }
  lock(): void {
    this.#gate += 1;
    if (this.#snapshot.phase === "unlocked" || this.#snapshot.phase === "createPin")
      this.#publish({ phase: "locked", notice: null });
  }

  async endSession(): Promise<void> {
    this.#gate += 1;
    // Hide the app immediately, even if Keystore fails. Do not let failed cleanup unlock it.
    this.#publish({ phase: "login", notice: { key: "mobile.login.sessionEnded" } });
    try {
      await this.#deps.kv.set(ENDED_KEY, "true");
    } finally {
      await this.#deps.credentials.clear();
    }
  }

  async login(username: string, password: string): Promise<void> {
    if (this.#isBusy) return;
    this.#isBusy = true;
    const gate = this.#gate;
    try {
      await this.#login(username.trim(), password, gate);
    } finally {
      this.#isBusy = false;
    }
  }

  async #login(username: string, password: string, gate: number): Promise<void> {
    if (!this.#snapshot.isOnline) {
      this.#publish({ notice: { key: "mobile.login.noSignal" } });
      return;
    }
    const counts = await this.#deps.outbox.countByStatus();
    if (!canLoginAs(username, this.#snapshot.profile?.username ?? null, counts)) {
      this.#publish({ notice: { key: "mobile.login.differentUser" } });
      return;
    }
    const answer = await this.#deps.login(username, password);
    if (gate !== this.#gate) return;
    if (!answer.ok) {
      this.#publish({ notice: answer.notice });
      return;
    }
    await this.#acceptLogin(answer.login, password, { gate, phoneTime: this.#deps.now() });
  }

  async #acceptLogin(
    login: Schemas["MobileLoginResponse"],
    password: string,
    attempt: { gate: number; phoneTime: number },
  ): Promise<void> {
    const { gate } = attempt;
    const verifier = await createVerifier(password, PASSWORD_ITERATIONS, this.#deps.randomBytes);
    if (gate !== this.#gate) return;
    const profile = await this.#persistLogin(login, verifier, gate);
    if (profile === null) return;
    this.#publish({
      profile,
      rules: readAuthRules(null),
      notice: null,
      phase: "createPin",
      hasClockSkew: hasClockSkew(
        login.server_time,
        attempt.phoneTime,
        readAuthRules(null).clockSkewReviewSeconds,
      ),
    });
    // Optional policy I/O must never hold the login busy guard or block PIN creation.
    void this.#finishLogin(
      { serverTime: login.server_time, phoneTime: attempt.phoneTime },
      profile,
    );
  }

  async #persistLogin(
    login: Schemas["MobileLoginResponse"],
    verifier: Verifier,
    gate: number,
  ): Promise<Profile | null> {
    const profile = profileOf(login.me);
    await this.#deps.kv.set(PROFILE_KEY, JSON.stringify(profile));
    await this.#deps.kv.set(RULES_KEY, JSON.stringify(null));
    await this.#deps.credentials.update((current) =>
      gate !== this.#gate
        ? current
        : {
            sessionId: toHex(this.#deps.randomBytes(16)),
            pair: { access: login.access, refresh: login.refresh },
            password: verifier,
            pin: null,
            pinAttempts: 0,
            passwordAttempts: 0,
          },
    );
    if (gate !== this.#gate) return null;
    await this.#deps.kv.set(ENDED_KEY, "false");
    return gate === this.#gate ? profile : null;
  }

  async #finishLogin(
    time: { serverTime: string; phoneTime: number },
    profile: Profile,
  ): Promise<void> {
    await this.#refreshRules(profile);
    if (!this.#isCurrentProfile(profile)) return;
    this.#publish({
      hasClockSkew: hasClockSkew(
        time.serverTime,
        time.phoneTime,
        this.#snapshot.rules.clockSkewReviewSeconds,
      ),
    });
  }

  #isCurrentProfile(profile: Profile): boolean {
    return this.#snapshot.profile === profile && this.#snapshot.phase !== "login";
  }

  async #refreshRules(profile: Profile): Promise<void> {
    try {
      const snapshot = await this.#deps.fetchRules();
      if (!isRulesSnapshot(snapshot) || !this.#isCurrentProfile(profile)) return;
      await this.#deps.kv.set(RULES_KEY, JSON.stringify(snapshot));
      if (this.#isCurrentProfile(profile)) this.#publish({ rules: readAuthRules(snapshot) });
    } catch {
      // A failed optional snapshot never blocks login. Defaults remain in force.
      if (this.#isCurrentProfile(profile)) this.#publish({ rules: readAuthRules(null) });
    }
  }

  async createPin(pin: string): Promise<boolean> {
    if (this.#snapshot.phase !== "createPin" || !isAllowedPin(pin) || this.#isBusy) return false;
    this.#isBusy = true;
    const gate = this.#gate;
    try {
      const verifier = await createVerifier(pin, PIN_ITERATIONS, this.#deps.randomBytes);
      if (gate !== this.#gate) return false;
      await this.#deps.credentials.update((current) =>
        gate !== this.#gate ? current : { ...current, pin: verifier, pinAttempts: 0 },
      );
      if (gate !== this.#gate) return false;
      this.#publish({ phase: "unlocked", notice: null });
      return true;
    } finally {
      this.#isBusy = false;
    }
  }

  async unlock(secret: string, kind: "pin" | "password"): Promise<void> {
    const gate = this.#gate;
    const isCorrect = await this.#unlock.attempt(secret, kind);
    if (gate !== this.#gate) return;
    if (this.#deps.credentials.getSnapshot().pair === null) {
      this.#publish({ phase: "login", notice: { key: "mobile.login.onlineRequired" } });
      return;
    }
    if (!isCorrect) {
      this.#publish({ notice: { key: "mobile.unlock.wrongSecret" } });
      return;
    }
    const hasPin = this.#deps.credentials.getSnapshot().pin !== null;
    this.#publish({ phase: hasPin ? "unlocked" : "createPin", notice: null });
  }

  canUseBiometrics(): boolean {
    return this.#snapshot.phase === "locked" && this.#unlock.canUseBiometrics();
  }
  biometricGate(): number {
    return this.#gate;
  }
  unlockBiometric(gate: number): void {
    if (gate !== this.#gate || !this.canUseBiometrics()) return;
    // Biometrics do not prove knowledge of the PIN, so they never reset its counter.
    this.#publish({ phase: "unlocked", notice: null });
  }

  #publish(patch: Partial<AuthSnapshot>): void {
    const attempts = this.#deps.credentials.getSnapshot().pinAttempts;
    this.#snapshot = {
      ...this.#snapshot,
      ...patch,
      isPinSetupRequired:
        this.#deps.credentials.getSnapshot().pair !== null &&
        this.#deps.credentials.getSnapshot().pin === null,
      isPasswordRequired:
        this.#deps.credentials.getSnapshot().pin === null ||
        attempts >= (patch.rules ?? this.#snapshot.rules).pinMaxAttempts,
      remainingAttempts: Math.max(
        0,
        (patch.rules ?? this.#snapshot.rules).pinMaxAttempts - attempts,
      ),
    };
    for (const listener of this.#listeners) listener();
  }
}

function profileOf(me: Schemas["Me"]): Profile {
  return {
    username: me.user.username,
    firstName: me.user.first_name,
    organization: me.organization,
    permissions: me.permissions,
  };
}
