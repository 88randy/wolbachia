import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { allQuadrantHistoryOptions } from "./geography-query";
import type { GeographyScope } from "./use-w-15";
/** Retirement evidence belongs to the quadrant publication, not to PointVersion. */
export function usePointRetirement(scope: GeographyScope, quadrant: string) {
  const { t } = useTranslation();
  const query = useQuery(allQuadrantHistoryOptions(scope, quadrant));
  return (point: Schemas["SamplingPoint"]) => {
    if (!point.current_version?.is_retired) return null;
    const resolution = query.data
      ?.flatMap((version) => version.point_resolutions)
      .find((item) => item.point === point.id && item.decision === "remove");
    return {
      reason: resolution?.evidence ?? t("geography.status.retired"),
      author:
        resolution?.created_by ?? point.current_version.created_by ?? t("geography.status.unknown"),
    };
  };
}
