import { NotFoundState } from "../../states/NotFoundState";
import { useGeographyScope } from "../geography/use-w-15";
import { MapEditorScreen } from "./MapEditorScreen";

/** W23 map editor: draw quadrants, place sampling and release points, move or correct them. */
export function W23MapEditorPage() {
  const scope = useGeographyScope();
  if (!scope.canRead || !(scope.canPublish || scope.canCreatePoint)) return <NotFoundState />;
  return <MapEditorScreen key={scope.context} scope={scope} />;
}
