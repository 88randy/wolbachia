import { NotFoundState } from "../../states/NotFoundState";
import { useGeographyScope } from "./use-w-15";
import { QuadrantList } from "./QuadrantList";
export function W22Page() {
  const scope = useGeographyScope();
  if (!scope.canRead) return <NotFoundState />;
  return <QuadrantList key={scope.context} scope={scope} />;
}
