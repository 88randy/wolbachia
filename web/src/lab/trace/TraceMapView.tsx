/* eslint-disable max-lines-per-function -- one declarative map: outlines, accuracy circle and two markers. */
import { useMemo } from "react";
import Map, { Layer, Marker, Source } from "react-map-gl/maplibre";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { Crosshair, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { web } from "@wolbachia/tokens";
import { baseMapStyle } from "../../quadrants/geography/map-features";
import { MAX_MAP_ZOOM } from "../../quadrants/geography/map-source";
import type { MapSource } from "../../quadrants/geography/map-source";
import { MapAttribution } from "../../quadrants/geography/MapAttribution";
import { useMapTheme } from "../../quadrants/geography/use-map-theme";
import { boundsOf, circleRing } from "./trace-geometry";
import type { MapPlace } from "./map-place";

const POINT_ZOOM = 18;
const PADDING = 48;

interface Props {
  place: MapPlace;
  source: MapSource;
  onFailure: () => void;
}

function ringOf(geometry: unknown): number[][] {
  const polygon = geometry as { coordinates?: number[][][] } | null;
  return polygon?.coordinates?.[0] ?? [];
}

function outline(kind: string, geometry: unknown) {
  return ringOf(geometry).length === 0
    ? []
    : [{ type: "Feature" as const, properties: { kind }, geometry: geometry as never }];
}

function initialView(place: MapPlace) {
  const [lng = 0, lat = 0] = place.point;
  const { capture } = place;
  const positions = [
    [lng, lat],
    ...(capture ? [[capture.lng, capture.lat]] : []),
    ...ringOf(place.block),
  ];
  const bounds = boundsOf(positions);
  const isSingle = bounds && bounds[0][0] === bounds[1][0] && bounds[0][1] === bounds[1][1];
  return isSingle || !bounds || place.isCentered
    ? { longitude: lng, latitude: lat, zoom: POINT_ZOOM }
    : { bounds, fitBoundsOptions: { padding: PADDING, maxZoom: POINT_ZOOM } };
}

/** The sampling point (pin), the courier's GPS reading (crosshair, with its accuracy circle) and the outlines. */
export default function TraceMapView({ place, source, onFailure }: Props) {
  const { t } = useTranslation();
  const colors = useMapTheme();
  const style = useMemo(
    () => baseMapStyle(source),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the url and kind define the style.
    [source.url, source.isRaster],
  );
  const [lng = 0, lat = 0] = place.point;
  const { capture } = place;
  const areas = {
    type: "FeatureCollection" as const,
    features: [...outline("quadrant", place.quadrant), ...outline("block", place.block)],
  };
  const accuracy = {
    type: "FeatureCollection" as const,
    features:
      capture?.accuracy_m && capture.accuracy_m > 0
        ? [
            {
              type: "Feature" as const,
              properties: {},
              geometry: {
                type: "Polygon" as const,
                coordinates: [circleRing(capture.lng, capture.lat, capture.accuracy_m)],
              },
            },
          ]
        : [],
  };
  return (
    <div className="relative h-80 w-full overflow-hidden rounded-xl border border-line">
      <Map
        initialViewState={initialView(place)}
        mapStyle={style}
        maxZoom={MAX_MAP_ZOOM}
        workerUrl={workerUrl}
        attributionControl={false}
        locale={{ "Map.Title": t("labTrace.map.label") }}
        onError={onFailure}
      >
        <Source id="trace-areas" type="geojson" data={areas}>
          <Layer
            id="trace-quadrant"
            type="line"
            filter={["==", ["get", "kind"], "quadrant"]}
            paint={{
              "line-color": colors.status.warning.fg,
              "line-width": web.focus.ring.width,
              "line-dasharray": [web.icon.sm, web.focus.ring.width],
            }}
          />
          <Layer
            id="trace-block-fill"
            type="fill"
            filter={["==", ["get", "kind"], "block"]}
            paint={{ "fill-color": colors.action, "fill-opacity": 0.12 }}
          />
          <Layer
            id="trace-block"
            type="line"
            filter={["==", ["get", "kind"], "block"]}
            paint={{ "line-color": colors.action, "line-width": web.focus.ring.width }}
          />
        </Source>
        <Source id="trace-accuracy" type="geojson" data={accuracy}>
          <Layer
            id="trace-accuracy-fill"
            type="fill"
            paint={{ "fill-color": colors.status.info.fg, "fill-opacity": 0.15 }}
          />
          <Layer
            id="trace-accuracy-line"
            type="line"
            paint={{ "line-color": colors.status.info.fg, "line-width": 1 }}
          />
        </Source>
        <Marker longitude={lng} latitude={lat} anchor="bottom">
          <span role="img" aria-label={t("labTrace.map.pointMarker", { code: place.pointCode })}>
            <MapPin
              aria-hidden="true"
              className="size-8 fill-action text-surface drop-shadow"
              strokeWidth={1.5}
            />
          </span>
        </Marker>
        {capture && (
          <Marker longitude={capture.lng} latitude={capture.lat} anchor="center">
            <span role="img" aria-label={t("labTrace.map.captureMarker")}>
              <Crosshair
                aria-hidden="true"
                className="size-7 rounded-full bg-surface text-warning-fg drop-shadow"
                strokeWidth={2.5}
              />
            </span>
          </Marker>
        )}
        <MapAttribution source={source.attribution} />
      </Map>
    </div>
  );
}
