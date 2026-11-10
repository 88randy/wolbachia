import { useLayoutEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "../../api/ApiClientProvider";
import { useMe } from "../../session/use-me";
import { useSessionIdentity } from "../../session/use-session-identity";
import { geographyContext } from "../../quadrants/geography/permissions";
import type { Me } from "../../session/me";
import { RELOCATIONS } from "./relocations-query";
function hasScope(dimension: Me["scope"]["centers"]) {
  return dimension.mode === "all" || (dimension.mode === "selected" && dimension.ids.length > 0);
}
/** Permission codes never replace explicit scope modes or backend object authorization. */
export function useRelocationScope() {
  const client = useApiClient();
  const me = useMe();
  const identity = useSessionIdentity();
  const cache = useQueryClient();
  const context = geographyContext(me) + "|" + (identity.activeCenter ?? "");
  const canRead =
    me.permissions.includes("relocation.read") &&
    hasScope(me.scope.centers) &&
    hasScope(me.scope.quadrants);
  useLayoutEffect(() => {
    const obsolete = {
      predicate: (query: { queryKey: readonly unknown[] }) =>
        query.queryKey[3] === RELOCATIONS && query.queryKey[4] !== context,
    };
    void cache.cancelQueries(obsolete);
    cache.removeQueries(obsolete);
  }, [cache, context]);
  return {
    client,
    context,
    canRead,
    identity: { ...identity, isSettled: identity.isSettled && canRead },
    canDecide: canRead && me.permissions.includes("relocation.decide"),
  };
}
