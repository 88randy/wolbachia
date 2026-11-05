import type { KvStore } from "../db/kv-store.ts";

export const SESSION_ENDED_KEY = "session_ended";

/** Boot must reconcile the end journal BEFORE any interrupted-password credential erasure. */
export async function readEndedSession(
  kv: Pick<KvStore, "get">,
  sessionId: string | null,
): Promise<boolean> {
  const marker = await kv.get(SESSION_ENDED_KEY);
  if (marker === "true") return true;
  if (sessionId !== null && marker === sessionId) return true;
  if (marker === null || !marker.startsWith("{")) return false;
  const value: unknown = JSON.parse(marker);
  if (typeof value !== "object" || value === null) return false;
  const journal = value as Record<string, unknown>;
  return journal.sessionId === sessionId && journal.status === "ended";
}
