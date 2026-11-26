import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import { useMe } from "../session/use-me";
import { useSessionIdentity } from "../session/use-session-identity";
import { centerStorageKey, hasCenterScope, writeCenter } from "./center-selection";
import { useActiveCenter } from "./use-active-center";
import { useCenterChange } from "./use-center-change";
import { centersOptions } from "./centers-query";
/** All picker options are intersected with explicit grants; no implicit all option. */
export function useCenterSelector() {
  const me = useMe();
  const selected = useActiveCenter();
  const canRead = me.permissions.includes("center.read") && hasCenterScope(me.scope);
  const options = centersOptions(useApiClient(), useSessionIdentity());
  const query = useQuery({ ...options, enabled: options.enabled && canRead });
  const centers = query.data?.filter(
    (center) => me.scope.centers.mode === "all" || me.scope.centers.ids.includes(center.id),
  );
  const key = centerStorageKey(me);
  const select = useCenterChange(centers?.map((center) => center.id) ?? []);
  useEffect(() => {
    if (centers === undefined) return;
    if (selected && !centers.some((center) => center.id === selected)) writeCenter(key, "");
  }, [centers, selected, key]);
  return {
    query,
    centers: centers ?? [],
    selected,
    select,
    canRead,
    isAll: me.scope.centers.mode === "all",
  };
}
export type CenterSelectorController = ReturnType<typeof useCenterSelector>;
