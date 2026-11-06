import type { Schemas } from "@wolbachia/api-client";

import type { AuthRules } from "./auth-rules.ts";
import type { Credentials } from "./credential-store.ts";
import type { LoginNotice } from "./login-error.ts";

export interface AuthProfile {
  readonly userId?: string;
  readonly sessionId?: string;
  readonly issuer?: string;
  readonly username: string;
  readonly firstName: string;
  readonly organization: Schemas["Me"]["organization"];
  readonly permissions: Schemas["Me"]["permissions"];
}
export interface AuthContext {
  readonly profile: AuthProfile | null;
  readonly rules: AuthRules;
  readonly notice: LoginNotice | null;
  readonly hasClockSkew: boolean;
  readonly isOnline: boolean;
}
export interface AuthSnapshot extends AuthContext {
  readonly phase: "login" | "createPin" | "locked" | "unlocked";
  readonly isPasswordRequired: boolean;
  readonly isPinSetupRequired: boolean;
  readonly remainingAttempts: number;
}

function authPhase(credentials: Credentials, isUnlocked: boolean): AuthSnapshot["phase"] {
  if (credentials.pair === null || credentials.status === "ended") return "login";
  if (!isUnlocked) return "locked";
  return credentials.pin === null ? "createPin" : "unlocked";
}

/** No independently mutable phase can disagree with durable credentials or a conservative lock. */
export function deriveAuthSnapshot(input: {
  credentials: Credentials;
  isUnlocked: boolean;
  context: AuthContext;
}): AuthSnapshot {
  const { credentials, context } = input;
  return {
    ...context,
    phase: authPhase(credentials, input.isUnlocked),
    notice:
      credentials.status === "ended" && (credentials.pair !== null || context.notice === null)
        ? { key: "mobile.login.sessionEnded" }
        : context.notice,
    isPinSetupRequired: credentials.pair !== null && credentials.pin === null,
    isPasswordRequired:
      credentials.pin === null || credentials.pinAttempts >= context.rules.pinMaxAttempts,
    remainingAttempts: Math.max(0, context.rules.pinMaxAttempts - credentials.pinAttempts),
  };
}
