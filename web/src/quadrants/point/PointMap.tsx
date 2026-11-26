import { lazy, Suspense } from "react";
import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineNotice } from "../../ui/InlineNotice";
import type { MapPlace } from "../../lab/trace/map-place";
import { MapBoundary } from "../geography/MapBoundary";
import { useMapDisplay } from "../geography/use-map-display";

const TraceMapView = lazy(() => import("../../lab/trace/TraceMapView"));

/** The sampling point on the map, centered, with the outlines of its block and quadrant. The exact numbers sit in the grid above. */
export function PointMap({ place }: { place: MapPlace }) {
  const { t } = useTranslation();
  const display = useMapDisplay();
  if (display.hasFailed || !display.source)
    return <InlineNotice tone="warning">{t("labTrace.map.unavailable")}</InlineNotice>;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <MapBoundary>
        <Suspense fallback={<Skeleton className="h-80 w-full rounded-xl" />}>
          <TraceMapView place={place} source={display.source} onFailure={display.fail} />
        </Suspense>
      </MapBoundary>
      <p className="m-0 flex items-center gap-1.5 text-xs text-ink-2">
        <MapPin aria-hidden="true" className="size-4 text-action" />
        {t("labTrace.map.legendPoint")}
      </p>
    </div>
  );
}
