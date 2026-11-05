import { useSyncExternalStore } from "react";

import { useServices } from "../app/services-context.ts";
import type { SyncEngine } from "./sync-engine.ts";
import type { SyncSnapshot } from "./sync-snapshot.ts";

/** The sync engine, for the code that enqueues events or retries. */
export function useSyncEngine(): SyncEngine {
  return useServices().engine;
}

/** The current sync snapshot; the component re-renders only when it changes. */
export function useSyncSnapshot(): SyncSnapshot {
  const { engine } = useServices();
  return useSyncExternalStore(engine.subscribe, engine.getSnapshot);
}
