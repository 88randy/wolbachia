import type { TokenStore } from "../auth/token-store.ts";
import type { SyncEngine } from "./sync-engine.ts";

/**
 * Notifications only hint at work; the engine reads the durable final-upload level itself.
 * The engine owns coalescing and retry deadlines regardless of its phase when this hint arrives.
 */
export function observeSyncSession(engine: SyncEngine, tokens: TokenStore): () => void {
  let previous = readCondition(tokens);
  return tokens.subscribe(() => {
    const current = readCondition(tokens);
    const hasEligibilityChanged = previous.canSync !== current.canSync;
    const hasAccessChanged = previous.access !== current.access;
    previous = current;
    if (!hasEligibilityChanged && !hasAccessChanged) return;
    void engine.hint();
  });
}

function readCondition(tokens: TokenStore) {
  return { canSync: tokens.hasSyncSession(), access: tokens.getAccessToken() };
}
