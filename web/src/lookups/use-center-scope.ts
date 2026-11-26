import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../api/ApiClientProvider";
import { centersOptions } from "../centers/centers-query";
import { useActiveCenter } from "../centers/use-active-center";
import { useUrlCenter } from "../centers/use-url-center";
import { useMe } from "../session/use-me";
import { useSessionIdentity } from "../session/use-session-identity";

/**
 * True when the scope of the user covers more than one center AND no single center is selected
 * (neither in the header switcher nor in the `center` filter of the list). Lists and records then
 * say which center each item belongs to; with one center selected that information is noise.
 */
export function useShowCenter(): boolean {
  const me = useMe();
  const activeCenter = useActiveCenter();
  const urlCenter = useUrlCenter();
  const centers = me.scope.centers;
  const canRead = me.permissions.includes("center.read");
  const options = centersOptions(useApiClient(), useSessionIdentity());
  const query = useQuery({
    ...options,
    enabled: options.enabled && canRead && centers.mode === "all",
  });
  if (urlCenter || activeCenter) return false;
  if (centers.mode === "selected") return centers.ids.length > 1;
  if (centers.mode !== "all") return false;
  return (query.data?.length ?? 0) > 1;
}
