import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import { readMapSource } from "../../quadrants/geography/map-source";
import type { MapSource } from "../../quadrants/geography/map-source";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { InlineNotice } from "../../ui/InlineNotice";

const Canvas = lazy(async () => ({
  default: (await import("./ReleasePointMapCanvas")).ReleasePointMapCanvas,
}));

interface Point {
  lng: number;
  lat: number;
}

function Coordinates({ point }: { point: Point }) {
  const { t, i18n } = useTranslation();
  const format = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 });
  return (
    <p className="m-0 text-sm font-semibold text-ink tabular-nums">
      {t("releases.detail.pointFallback", {
        lat: format.format(point.lat),
        lng: format.format(point.lng),
      })}
    </p>
  );
}

interface MapBoxProps {
  point: Point;
  source: MapSource;
  onFailure: () => void;
}

function MapBox({ point, source, onFailure }: MapBoxProps) {
  return (
    <>
      <div className="h-72 overflow-hidden rounded-xl border border-line">
        <Suspense fallback={<CardSkeleton />}>
          <Canvas point={point} source={source} onFailure={onFailure} />
        </Suspense>
      </div>
    </>
  );
}

/** The release point on the map, with its coordinates as text so nothing depends on WebGL. */
export function ReleasePointMap({ point }: { point: Point | null }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  if (point === null)
    return <p className="m-0 text-sm text-ink-2">{t("releases.detail.pointMissing")}</p>;
  const source = readMapSource({
    VITE_MAP_TILES_URL: import.meta.env["VITE_MAP_TILES_URL"],
    VITE_MAP_ATTRIBUTION: import.meta.env["VITE_MAP_ATTRIBUTION"],
  });
  const usable = !failed && source !== null && typeof WebGL2RenderingContext !== "undefined";
  return (
    <div className="flex flex-col gap-3">
      <Coordinates point={point} />
      {usable ? (
        <MapBox
          point={point}
          source={source}
          onFailure={() => {
            setFailed(true);
          }}
        />
      ) : (
        <InlineNotice tone="info">{t("releases.detail.mapUnavailable")}</InlineNotice>
      )}
    </div>
  );
}
