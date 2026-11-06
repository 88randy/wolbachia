import { useEffect, useSyncExternalStore } from "react";
import { useMe } from "../session/use-me";
import { centerStorageKey, readCenter, subscribeCenter, writeCenter } from "./center-selection";
/** Derive the filter from explicit scope before effects, independently of center.read/list access. */
export function useActiveCenter(): string {
  const me = useMe();
  const key = centerStorageKey(me);
  const stored = useSyncExternalStore(subscribeCenter, () => readCenter(key));
  const centers = me.scope.centers;
  const isAllowed =
    centers.mode === "all" || (centers.mode === "selected" && centers.ids.includes(stored));
  useEffect(() => {
    if (stored && !isAllowed && readCenter(key) === stored) writeCenter(key, "");
  }, [key, stored, isAllowed]);
  return isAllowed ? stored : "";
}
