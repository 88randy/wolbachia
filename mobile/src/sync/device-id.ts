import { KV_KEYS } from "../db/kv-store.ts";
import type { KvStore } from "../db/kv-store.ts";

/**
 * The id of this phone as the server knows it (`device_id` of the sync request and of the login).
 * Generated once on first run and kept; a second call returns the same id.
 */
export async function getOrCreateDeviceId(kv: KvStore, newUuid: () => string): Promise<string> {
  const existing = await kv.get(KV_KEYS.deviceId);
  if (existing !== null) return existing;
  const created = newUuid();
  await kv.set(KV_KEYS.deviceId, created);
  return created;
}
