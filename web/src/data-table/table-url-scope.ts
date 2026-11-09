import type { SearchPatch } from "./table-types";
export interface TableUrlScope {
  prefix?: string;
  ignoredPrefixes?: readonly string[];
}
/** A nested table owns only its prefixed URL keys; its parent retains the rest. */
export function scopedTableSearch(search: Readonly<Record<string, unknown>>, scope: TableUrlScope) {
  const prefix = scope.prefix ?? "";
  return Object.fromEntries(
    Object.entries(search)
      .filter(
        ([key]) =>
          key.startsWith(prefix) &&
          !scope.ignoredPrefixes?.some((ignored) => key.startsWith(ignored)),
      )
      .map(([key, value]) => [key.slice(prefix.length), value]),
  );
}
export function scopedTablePatch(patch: SearchPatch, prefix = ""): SearchPatch {
  return Object.fromEntries(Object.entries(patch).map(([key, value]) => [prefix + key, value]));
}
