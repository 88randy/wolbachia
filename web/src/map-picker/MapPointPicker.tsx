import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineNotice } from "../ui/InlineNotice";
import { MapBoundary } from "../quadrants/geography/MapBoundary";
import { useMapDisplay } from "../quadrants/geography/use-map-display";
import type { PickerArea } from "./picker-types";

const PointPickerMap = lazy(() => import("./PointPickerMap"));

interface Props {
  /** `[longitude, latitude]` or null while nothing is placed. */
  value: number[] | null;
  onChange: (location: number[]) => void;
  areas?: readonly PickerArea[];
  label: string;
}

/**
 * The one way to set a location on the web: click the map, drag the pin. Coordinates only
 * appear read-only under "Advanced".
 */
export function MapPointPicker({ value, onChange, areas = [], label }: Props) {
  const { t } = useTranslation();
  const display = useMapDisplay();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-ink">{label}</span>
      <p className="m-0 text-xs text-ink-2">{t("mapPicker.hint")}</p>
      {display.hasFailed || !display.source ? (
        <InlineNotice tone="warning">{t("mapPicker.unavailable")}</InlineNotice>
      ) : (
        <MapBoundary>
          <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
            <PointPickerMap
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
        {value ? t("mapPicker.placed") : t("mapPicker.empty")}
      </p>
      {value && (
        <details className="text-xs text-ink-2">
          <summary className="cursor-pointer">{t("mapPicker.advanced")}</summary>
          <p className="m-0 pt-1 font-mono tabular-nums">{value.join(", ")}</p>
        </details>
      )}
    </div>
  );
}
