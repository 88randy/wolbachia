import { useState } from "react";
/** Same-identity reauthentication retires prior optimistic intent without a stale callback clearing newer intent. */
export function useCatalogOptimistic<T>(revision: number) {
  const [snapshot, setSnapshot] = useState<{ revision: number; value: T | null } | null>(null);
  const setValue = (value: T | null) => {
    setSnapshot({ revision, value });
  };
  return [snapshot?.revision === revision ? snapshot.value : null, setValue] as const;
}
