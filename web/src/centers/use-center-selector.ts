import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import { useMe } from "../session/use-me";
import { useSessionIdentity } from "../session/use-session-identity";
import { centerStorageKey, hasCenterScope, writeCenter } from "./center-selection";
import { useActiveCenter } from "./use-active-center";
import { useCenterChange } from "./use-center-change";
import { centersOptions } from "./centers-query";
/**
 * The list of centers does not depend on the selected center, but its key does. Keep the previous
 * list (same user, organization, revision and grants) while the new key loads, so the picker does
 * not unmount and drop keyboard focus right after a selection.
 */
function keepCenterList<T>(
  identity: ReturnType<typeof useSessionIdentity>,
  previous: T | undefined,
  previousQuery:
    { queryKey: readonly unknown[]; meta?: Readonly<Record<string, unknown>> } | undefined,
): T | undefined {
  const key = previousQuery?.queryKey ?? [];
  const isSameOwner = key[1] === identity.userId && key[2] === identity.organizationSlug;
  const isSameSession =
    previousQuery?.meta?.["revision"] === identity.revision &&
    previousQuery.meta["authorization"] === identity.authorization;
  return isSameOwner && isSameSession ? previous : undefined;
}

/** All picker options are intersected with explicit grants; no implicit all option. */
export function useCenterSelector() {
  const me = useMe();
  const selected = useActiveCenter();
  const canRead = me.permissions.includes("center.read") && hasCenterScope(me.scope);
  const identity = useSessionIdentity();
  const options = centersOptions(useApiClient(), identity);
  const query = useQuery({
    ...options,
    enabled: options.enabled && canRead,
    placeholderData: (previous, previousQuery) => keepCenterList(identity, previous, previousQuery),
  });
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
