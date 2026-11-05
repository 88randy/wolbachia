import { useSyncExternalStore } from "react";
import { useMe } from "../session/use-me";
import { centerStorageKey, readCenter, subscribeCenter } from "./center-selection";
/** The filter is independent of session state and cannot mutate /me/ grants. */
export function useActiveCenter(): string {
  const key = centerStorageKey(useMe());
  return useSyncExternalStore(subscribeCenter, () => readCenter(key));
}
