import type { Schemas } from "@wolbachia/api-client";
import { Map as MapIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LazyGeographyMap } from "../../quadrants/geography/LazyGeographyMap";
import type { MapCourier } from "../../quadrants/geography/map-types";
import { Card } from "../../ui/Card";
import { CourierDot } from "../../quadrants/geography/CourierDot";
import { EmptyState } from "../../ui/EmptyState";
import { InlineNotice } from "../../ui/InlineNotice";
import { STALE_AFTER_MINUTES } from "../track/track-model";
import type { LngLat } from "../track/track-model";

interface Props {
  quadrants: readonly Schemas["Quadrant"][];
  couriers: readonly MapCourier[];
  track: readonly LngLat[][];
  /** Error keys of the position and track reads, already filtered by permission. */
  errors: readonly ("live.position.error" | "live.track.error")[];
}

/** W28 map: work areas, couriers' last positions and the focused courier's track. */
export function LiveMapCard({ quadrants, couriers, track, errors }: Props) {
  const { t } = useTranslation();
  const hasContent = quadrants.length > 0 || couriers.length > 0 || track.length > 0;
  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <MapIcon aria-hidden="true" className="size-4" />
          {t("live.mapTitle")}
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        {errors.map((key) => (
          <InlineNotice key={key} tone="warning">
            {t(key)}
          </InlineNotice>
        ))}
        {hasContent ? (
          <LazyGeographyMap quadrants={quadrants} couriers={couriers} track={track} />
        ) : (
          <EmptyState kind="noData" message={t("live.noMap")} />
        )}
        {couriers.length > 0 && <PositionLegend />}
      </div>
    </Card>
  );
}

function PositionLegend() {
  const { t } = useTranslation();
  const minutes = STALE_AFTER_MINUTES;
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-ink-2">
      <li className="flex items-center gap-2">
        <span aria-hidden="true">
          <CourierDot label="" isStale={false} />
        </span>
        {t("live.legend.recent", { minutes })}
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true">
          <CourierDot label="" isStale />
        </span>
        {t("live.legend.stale", { minutes })}
      </li>
    </ul>
  );
}
