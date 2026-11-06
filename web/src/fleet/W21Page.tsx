import { useUrlCenter } from "../centers/use-url-center";
import { useActiveCenter } from "../centers/use-active-center";
import { useParams } from "@tanstack/react-router";
import { useMe } from "../session/use-me";
import { NotFoundState } from "../states/NotFoundState";
import { fleetIdentity } from "./fleet-query";
import { MotorcycleRecord } from "./MotorcycleRecord";
/** W21 uses a human code; every API mutation uses the resolved id. */
export function W21Page() {
  const { code } = useParams({ strict: false });
  const me = useMe();
  const urlCenter = useUrlCenter();
  const activeCenter = useActiveCenter();
  if (!code) return <NotFoundState />;
  return (
    <MotorcycleRecord
      key={`${fleetIdentity(me)}|${code}|${urlCenter ?? activeCenter}`}
      code={code}
      urlCenter={urlCenter}
    />
  );
}
