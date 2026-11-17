import { lazy, Suspense } from "react";
import { Crosshair, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineNotice } from "../../ui/InlineNotice";
import { MapBoundary } from "../../quadrants/geography/MapBoundary";
import { useMapDisplay } from "../../quadrants/geography/use-map-display";
import { TraceCoordinates } from "./TraceCoordinates";
import { TraceLinks } from "./TraceLinks";
import type { BagTrace } from "./trace-query";

const TraceMapView = lazy(() => import("./TraceMapView"));

function Legend({ hasCapture }: { hasCapture: boolean }) {
  const { t } = useTranslation();
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-xs text-ink-2">
      <li className="flex items-center gap-1.5">
        <MapPin aria-hidden="true" className="size-4 text-action" />
        {t("labTrace.map.legendPoint")}
      </li>
      {hasCapture && (
        <li className="flex items-center gap-1.5">
          <Crosshair aria-hidden="true" className="size-4 text-warning-fg" />
          {t("labTrace.map.legendCapture")}
        </li>
      )}
      {hasCapture && <li>{t("labTrace.map.legendAccuracy")}</li>}
    </ul>
  );
}

/** Map of the exact point and where the courier took the reading, plus its text equivalent. */
export function TraceMap({ trace }: { trace: BagTrace }) {
  const { t } = useTranslation();
  const display = useMapDisplay();
  const failed = display.hasFailed || !display.source;
  return (
    <section aria-label={t("labTrace.map.title")} className="flex min-w-0 flex-col gap-3">
      <h3 className="m-0 text-sm font-semibold text-ink">{t("labTrace.map.title")}</h3>
      {failed ? (
        <InlineNotice tone="warning">{t("labTrace.map.unavailable")}</InlineNotice>
      ) : (
        <MapBoundary>
          <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
            {display.source && (
              <TraceMapView trace={trace} source={display.source} onFailure={display.fail} />
            )}
          </Suspense>
        </MapBoundary>
      )}
      <Legend hasCapture={trace.reading.capture !== null} />
      <TraceLinks trace={trace} />
      <TraceCoordinates trace={trace} />
    </section>
  );
}
