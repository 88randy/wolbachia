import type { Me } from "../session/me";
import { readStored, removeStored, writeStored } from "../storage/safe-storage";
const listeners = new Set<() => void>();
const selections = new Map<string, string>();
/** Preferences never confer a grant; callers validate the id against backend-scoped centers. */
export function centerStorageKey(me: Pick<Me, "user" | "organization">): string {
  return `wolbachia.center.${me.user.id}.${me.organization?.slug ?? ""}`;
}
export function readCenter(key: string): string {
  return selections.get(key) ?? readStored(key) ?? "";
}
export function subscribeCenter(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function writeCenter(key: string, center: string): void {
  selections.set(key, center);
  if (center) writeStored(key, center);
  else removeStored(key);
  listeners.forEach((listener) => {
    listener();
  });
}
/** Empty selected is a denial; only explicit all permits the all-centers filter. */
export function hasCenterScope(scope: Me["scope"]): boolean {
  return (
    scope.centers.mode === "all" ||
    (scope.centers.mode === "selected" && scope.centers.ids.length > 0)
  );
}
export function authorizationKey(me: Pick<Me, "permissions" | "scope">): string {
  return JSON.stringify([me.permissions, me.scope]);
}
