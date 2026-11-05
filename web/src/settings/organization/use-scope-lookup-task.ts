import { useEffect, useRef } from "react";
import type { BeginScopeLookup } from "./scope-types";
/** Cleanup and settlement share an idempotent release; duplicate clicks cannot replace it. */
export function useScopeLookupTask(begin: BeginScopeLookup) {
  const task = useRef<{ finish: (() => void) | null }>({ finish: null }).current;
  useEffect(
    () => () => {
      task.finish?.();
    },
    [task],
  );
  return async (request: () => Promise<void>) => {
    if (task.finish) return;
    const finish = begin();
    task.finish = finish;
    try {
      await request();
    } finally {
      finish();
      task.finish = null;
    }
  };
}
