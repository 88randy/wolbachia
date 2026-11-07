import { useMe } from "../session/use-me";
import { fleetIdentity } from "./fleet-query";
import { FleetList } from "./FleetList";
import { hasCenterScope } from "../centers/center-selection";
import { NoPermissionState } from "../states/NoPermissionState";
/** W20 remounts all drafts and query observers when the session context changes. */
export function W20Page() {
  const me = useMe();
  return hasCenterScope(me.scope) ? (
    <FleetList key={fleetIdentity(me)} />
  ) : (
    <NoPermissionState areaId="fleet" />
  );
}
