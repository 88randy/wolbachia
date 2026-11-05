import type { QueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "../session/use-me";
import type { Me } from "../session/me";
import { centerStorageKey, readCenter, writeCenter } from "./center-selection";
/** Cancel/remove synchronously: responses from the old filter cannot repopulate its cache. */
function discardCenterResults(queryClient: QueryClient, me: Me) {
  const filters = {
    predicate: (entry: { queryKey: readonly unknown[] }) =>
      entry.queryKey[0] === "org" &&
      entry.queryKey[1] === me.user.id &&
      entry.queryKey[2] === me.organization?.slug,
  };
  void queryClient.cancelQueries(filters);
  queryClient.removeQueries(filters);
}
export function useCenterChange(ids: string[]) {
  const me = useMe();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return (center: string) => {
    if (center && !ids.includes(center)) return;
    if (!center && me.scope.centers.mode !== "all") return;
    const key = centerStorageKey(me);
    if (readCenter(key) === center) return;
    discardCenterResults(queryClient, me);
    writeCenter(key, center);
    void navigate({ to: ".", search: {} });
  };
}
