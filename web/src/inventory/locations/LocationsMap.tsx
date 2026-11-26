import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import type { ReactNode } from "react";
import { Card } from "../../ui/Card";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { InlineNotice } from "../../ui/InlineNotice";
import { readMapSource } from "../../quadrants/geography/map-source";
import { LocationMapBoundary } from "./LocationMapBoundary";
import styles from "../inventory.module.css";
const Canvas = lazy(async () => ({
  default: (await import("./LocationMapCanvas")).LocationMapCanvas,
}));
function validPoint(location: Schemas["Location"]) {
  const point = location.geometry.coordinates;
  return (
    point.length === 2 &&
    point.every(Number.isFinite) &&
    Math.abs(Number(point[0])) <= 180 &&
    Math.abs(Number(point[1])) <= 90
  );
}
function MapFrame({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Card title={t("inventory.section.map")}>
      <LocationMapBoundary fallback={fallback}>
        <Suspense fallback={<CardSkeleton />}>{children}</Suspense>
      </LocationMapBoundary>
    </Card>
  );
}
/** Receives exactly the accepted DataTable page; never loads a map-wide collection. */
export function LocationsMap({ locations }: { locations: readonly Schemas["Location"][] }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const source = configuredSource();
  const unavailable =
    failed ||
    !locations.every(validPoint) ||
    typeof WebGL2RenderingContext === "undefined" ||
    !source;
  const fallback = <InlineNotice tone="info">{t("inventory.map.fallback")}</InlineNotice>;
  if (locations.length === 0) return null;
  return (
    <MapFrame fallback={fallback}>
      {unavailable ? (
        fallback
      ) : (
        <div className={styles.map}>
          <Canvas
            key={locations.map((location) => location.version).join("|")}
            locations={locations}
            source={source}
            onFailure={() => {
              setFailed(true);
            }}
          />
        </div>
      )}
    </MapFrame>
  );
}
function configuredSource() {
  return readMapSource({
    VITE_MAP_TILES_URL: import.meta.env["VITE_MAP_TILES_URL"],
    VITE_MAP_ATTRIBUTION: import.meta.env["VITE_MAP_ATTRIBUTION"],
  });
}
