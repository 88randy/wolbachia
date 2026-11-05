import type { TokenStore } from "../auth/token-store.ts";
import type { SyncEngine } from "./sync-engine.ts";

/**
 * A retained pair ending/rotating is not new work: never bypass an in-flight pass or retry timer.
 * New/removed sync eligibility still wakes the worker; idle/blocked workers can attempt final sync.
 */
export function observeSyncSession(engine: SyncEngine, tokens: TokenStore): () => void {
  let previous = readCondition(tokens);
  return tokens.subscribe(() => {
    const current = readCondition(tokens);
    const hasEligibilityChanged = previous.canSync !== current.canSync;
    const hasAccessChanged = previous.access !== current.access;
    previous = current;
    if (!hasEligibilityChanged && !hasAccessChanged) return;
    const phase = engine.getSnapshot().phase;
    if (!hasEligibilityChanged && (phase === "syncing" || phase === "waitingRetry")) return;
    engine.notifyConditionsChanged();
  });
}

function readCondition(tokens: TokenStore) {
  return { canSync: tokens.hasSyncSession(), access: tokens.getAccessToken() };
}
