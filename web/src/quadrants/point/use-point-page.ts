/* eslint-disable max-lines-per-function, complexity -- fast mode (demo 2026-11-20): one declarative screen. */
import { useQuery } from "@tanstack/react-query";
import { useCan } from "../../session/use-can";
import { quadrantRecordOptions } from "../geography/geography-query";
import type { GeographyScope } from "../geography/use-w-15";
import {
  pointBlockOptions,
  pointLifecycleOptions,
  pointOptions,
  pointOvitrapsOptions,
  pointReadingsOptions,
} from "./point-query";

/** Everything the point page shows. Each part loads on its own and is off without its permission. */
export function usePointPage(scope: GeographyScope, quadrantCode: string, pointCode: string) {
  const can = useCan();
  const isSettled = scope.identity.isSettled;
  const quadrant = useQuery(quadrantRecordOptions(scope, quadrantCode));
  const quadrantId = quadrant.data?.id ?? "";
  const point = useQuery({
    ...pointOptions(scope, quadrantId, pointCode),
    enabled: isSettled && quadrantId !== "",
  });
  const pointId = point.data?.id ?? "";
  const block = useQuery({
    ...pointBlockOptions(scope, point.data?.block ?? ""),
    enabled: isSettled && pointId !== "",
  });
  const ovitraps = useQuery({
    ...pointOvitrapsOptions(scope, pointId),
    enabled: isSettled && pointId !== "" && can("ovitrap.read"),
  });
  const anyTrap = ovitraps.data?.results[0];
  const lifecycle = useQuery({
    ...pointLifecycleOptions(scope, anyTrap?.id ?? ""),
    enabled: isSettled && anyTrap !== undefined,
  });
  const readings = useQuery({
    ...pointReadingsOptions(scope, pointId),
    enabled: isSettled && pointId !== "" && can("reading.read"),
  });
  return {
    quadrant,
    point,
    block,
    ovitraps,
    lifecycle,
    readings,
    canSeeTraps: can("ovitrap.read"),
    canSeeReadings: can("reading.read"),
  };
}
export type PointPageData = ReturnType<typeof usePointPage>;
