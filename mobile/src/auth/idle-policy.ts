import type { AuthSnapshot } from "./auth-state.ts";

/** Every phase usable without a secret must keep idle protection active. */
export function shouldRunIdleTimer(phase: AuthSnapshot["phase"]): boolean {
  return phase === "unlocked" || phase === "createPin";
}
