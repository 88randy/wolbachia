/* eslint-disable max-lines-per-function, complexity -- fast mode (demo 2026-11-20): one declarative screen. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DetailPage } from "../../components/templates/DetailPage";
import { DetailSection } from "../../components/templates/DetailSection";
import type { MapPlace } from "../../lab/trace/map-place";
import { StatusPill } from "../../ui/StatusPill";
import { PointBagsSection } from "./PointBagsSection";
import { PointDataSection } from "./PointDataSection";
import { PointHistorySection } from "./PointHistorySection";
import { PointMap } from "./PointMap";
import type { PointPageData } from "./use-point-page";

function placeOf(data: PointPageData): MapPlace | null {
  const location = data.point.data?.current_version?.location;
  if (!data.point.data || !location) return null;
  return {
    pointCode: data.point.data.code,
    point: location,
    capture: null,
    block: data.block.data?.current_version?.geometry ?? null,
    quadrant: data.quadrant.data?.current_version?.geometry ?? null,
    isCentered: true,
  };
}

/** Read-only page of one sampling point: where it is, the ovitrap that is there, what happened and its bags. */
export function PointRecord({ data, quadrantCode }: { data: PointPageData; quadrantCode: string }) {
  const { t } = useTranslation();
  const [showVoided, setShowVoided] = useState(false);
  const point = data.point.data;
  if (!point) return null;
  const place = placeOf(data);
  const isRetired = point.current_version?.is_retired ?? false;
  return (
    <DetailPage
      title={t("pointPage.title", { code: point.code })}
      subtitle={t("pointPage.subtitle", { block: point.block_code ?? "", quadrant: quadrantCode })}
      status={
        <StatusPill tone={isRetired ? "neutral" : "success"}>
          {t(isRetired ? "geography.status.retired" : "geography.status.active")}
        </StatusPill>
      }
      back={{
        label: t("pointPage.back", { code: quadrantCode }),
        link: {
          to: "/quadrants/$code/versions",
          params: { code: quadrantCode },
          search: { view: "points" },
        },
      }}
    >
      <PointDataSection data={data} />
      {place && (
        <DetailSection title={t("pointPage.map.title")}>
          <PointMap place={place} />
        </DetailSection>
      )}
      {(data.canSeeTraps || data.canSeeReadings) && (
        <PointHistorySection data={data} showVoided={showVoided} onShowVoided={setShowVoided} />
      )}
      {data.canSeeReadings && <PointBagsSection data={data} showVoided={showVoided} />}
    </DetailPage>
  );
}
