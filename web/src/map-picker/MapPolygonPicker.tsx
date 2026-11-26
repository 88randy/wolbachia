/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): declarative screen pieces. */
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineNotice } from "../ui/InlineNotice";
import { MapBoundary } from "../quadrants/geography/MapBoundary";
import { useMapDisplay } from "../quadrants/geography/use-map-display";
import type { Polygon } from "../quadrants/geography/geometry";
import { polygonAreaKm2 } from "../quadrants/editor/geo-math";
import type { PickerArea } from "./picker-types";

const PolygonPickerMap = lazy(() => import("./PolygonPickerMap"));

interface Props {
  value: Polygon | null;
  onChange: (polygon: Polygon | null) => void;
  areas?: readonly PickerArea[];
  label: string;
}

/** Draw a zone on the map (blocks, permit zones). Coordinates are never typed. */
export function MapPolygonPicker({ value, onChange, areas = [], label }: Props) {
  const { t, i18n } = useTranslation();
  const display = useMapDisplay();
  const area = value
    ? new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 }).format(
        polygonAreaKm2(value),
      )
    : null;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-ink">{label}</span>
      <p className="m-0 text-xs text-ink-2">
        {t("mapEditor.quadrant.step1")} {t("mapEditor.quadrant.step2")}
      </p>
      {display.hasFailed || !display.source ? (
        <InlineNotice tone="warning">{t("mapPicker.unavailable")}</InlineNotice>
      ) : (
        <MapBoundary>
          <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
            <PolygonPickerMap
              value={value}
              onChange={onChange}
              areas={areas}
              source={display.source}
              onFailure={display.fail}
              label={label}
            />
          </Suspense>
        </MapBoundary>
      )}
      <p className="m-0 text-sm text-ink" role="status">
        {area ? t("mapEditor.fact.areaValue", { area }) : t("mapPicker.empty")}
      </p>
    </div>
  );
}
