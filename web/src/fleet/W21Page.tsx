import { useUrlCenter } from "../centers/use-url-center";
import { useParams } from "@tanstack/react-router";
import { useMe } from "../session/use-me";
import { NotFoundState } from "../states/NotFoundState";
import { fleetIdentity } from "./fleet-query";
import { MotorcycleRecord } from "./MotorcycleRecord";
import { hasCenterScope } from "../centers/center-selection";
/** W21 uses a human code; every API mutation uses the resolved id. */
export function W21Page() {
  const { code } = useParams({ strict: false });
  const me = useMe();
  const urlCenter = useUrlCenter();
  if (!code || !hasCenterScope(me.scope)) return <NotFoundState />;
  return (
    <MotorcycleRecord key={`${fleetIdentity(me)}|${code}`} code={code} urlCenter={urlCenter} />
  );
}
