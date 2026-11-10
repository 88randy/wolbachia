/* eslint-disable max-lines-per-function, complexity -- presentational JSX of a screen; splitting it into one-use fragments would hurt readability. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import Map, { Layer, Source } from "react-map-gl/maplibre";
import type { MapEvent } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { baseMapStyle } from "../quadrants/geography/map-features";
import { MAX_MAP_ZOOM } from "../quadrants/geography/map-source";
import type { MapSource } from "../quadrants/geography/map-source";
import { LEVELS, LEVEL_PAINT, levelOf, maxReleases, patternImage } from "./zone-levels";
import type { Zone } from "./portal-data";

const PADDING = 32;
const MAP_HEIGHT = "26rem";

function bounds(zones: readonly Zone[]): [[number, number], [number, number]] {
  const points = zones.flatMap((zone) => zone.geometry.coordinates[0] ?? []);
  const lons = points.map((point) => Number(point[0]));
  const lats = points.map((point) => Number(point[1]));
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}

/** Quadrant polygons on the OSM tiles: fill color AND pattern say how many releases each has. */
export function PortalMapCanvas({
  zones,
  source,
  onFailure,
}: {
  zones: readonly Zone[];
  source: MapSource;
  onFailure: () => void;
}) {
  const { t } = useTranslation();
  const [isReady, setIsReady] = useState(false);
  const max = maxReleases(zones);
  const collection = {
    type: "FeatureCollection" as const,
    features: zones.map((zone) => ({
      type: "Feature" as const,
      properties: { code: zone.code, level: levelOf(zone.releases, max) },
      geometry: zone.geometry,
    })),
  };
  const onLoad = (event: MapEvent) => {
    for (const level of LEVELS) {
      const image = patternImage(level);
      if (image !== null && !event.target.hasImage(`zone-${level}`))
        event.target.addImage(`zone-${level}`, image);
    }
    setIsReady(true);
  };
  return (
    <div style={{ height: MAP_HEIGHT }} className="overflow-hidden rounded-2xl border border-line">
      <Map
        locale={{ "Map.Title": t("portal.map.label") }}
        initialViewState={{
          bounds: bounds(zones),
          fitBoundsOptions: { padding: PADDING, maxZoom: 15 },
        }}
        mapStyle={baseMapStyle(source)}
        maxZoom={MAX_MAP_ZOOM}
        workerUrl={workerUrl}
        attributionControl={false}
        onError={onFailure}
        onLoad={onLoad}
      >
        {isReady && (
          <Source id="portal-zones" type="geojson" data={collection}>
            <Layer
              id="zones-fill"
              type="fill"
              paint={{
                "fill-pattern": ["concat", "zone-", ["get", "level"]],
                "fill-opacity": 0.85,
              }}
            />
            {LEVELS.map((level) => (
              <Layer
                key={level}
                id={`zones-line-${level}`}
                type="line"
                filter={["==", ["get", "level"], level]}
                paint={{ "line-color": LEVEL_PAINT[level].line, "line-width": 2 }}
              />
            ))}
          </Source>
        )}
      </Map>
    </div>
  );
}
