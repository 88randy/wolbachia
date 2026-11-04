import { OpSqliteStore } from './opSqliteStore';
import type { EventStore } from './types';
import { WatermelonStore } from './watermelonStore';

export type StoreKey = 'op-sqlite' | 'WatermelonDB';

/**
 * Module-level singletons: the stores live as long as the JS runtime, so switching tabs (which unmounts
 * the Store screen) never reopens the database and the timings are not polluted by repeated opens.
 */
const stores: Record<StoreKey, EventStore> = {
  'op-sqlite': new OpSqliteStore(),
  WatermelonDB: new WatermelonStore(),
};

const openings = new Map<StoreKey, Promise<EventStore>>();
const openDurations = new Map<StoreKey, number>();

export type OpenedStore = { store: EventStore; firstOpenMs: number | null };

/**
 * Opens a store once. Concurrent callers share the same promise. A failed open is forgotten so the
 * next call retries. firstOpenMs is set only for the call that actually opened the database.
 */
export async function openStore(key: StoreKey): Promise<OpenedStore> {
  let opening = openings.get(key);
  let isFirst = false;
  if (opening === undefined) {
    isFirst = true;
    const store = stores[key];
    const startedAt = performance.now();
    opening = store.open().then(() => {
      openDurations.set(key, performance.now() - startedAt);
      return store;
    });
    openings.set(key, opening);
    opening.catch(() => openings.delete(key));
  }
  const store = await opening;
  return { store, firstOpenMs: isFirst ? (openDurations.get(key) ?? null) : null };
}
