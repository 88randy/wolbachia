import { useGeographyScope } from "../../quadrants/geography/use-w-15";
import { NotFoundState } from "../../states/NotFoundState";
import { ClosureRecord } from "./ClosureRecord";
import { useClosureCache } from "./use-closure-cache";
export function W33Page({ code }: { code: string }) {
  const scope = useGeographyScope();
  useClosureCache(scope.context);
  if (!scope.canRead || !scope.me.permissions.includes("quadrant.close")) return <NotFoundState />;
  return <ClosureRecord key={scope.context + "|" + code} scope={scope} code={code} />;
}
