import { useMe } from "../session/use-me";
import { fleetIdentity } from "./fleet-query";
import { FleetList } from "./FleetList";
/** W20 remounts all drafts and query observers when the session context changes. */
export function W20Page() {
  return <FleetList key={fleetIdentity(useMe())} />;
}
