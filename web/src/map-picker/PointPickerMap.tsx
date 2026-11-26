/* eslint-disable max-lines-per-function -- one declarative map: context areas and a draggable pin. */
import { useMemo } from "react";
import Map, { Layer, Marker, Source } from "react-map-gl/maplibre";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin } from "lucide-react";
import { baseMapStyle } from "../quadrants/geography/map-features";
import { MAX_MAP_ZOOM } from "../quadrants/geography/map-source";
import type { MapSource } from "../quadrants/geography/map-source";
import { MapAttribution } from "../quadrants/geography/MapAttribution";
import { useMapTheme } from "../quadrants/geography/use-map-theme";
import type { PickerArea } from "./picker-types";

const MERIDA = { longitude: -89.62, latitude: 20.97, zoom: 12 };
const DECIMALS = 7;
const round = (value: number) => Number(value.toFixed(DECIMALS));

interface Props {
  value: number[] | null;
  onChange: (location: number[]) => void;
  areas: readonly PickerArea[];
  source: MapSource;
  onFailure: () => void;
  label: string;
}

function initialView(value: number[] | null, areas: readonly PickerArea[]) {
  if (value) return { longitude: value[0] ?? 0, latitude: value[1] ?? 0, zoom: 17 };
  const vertices = areas.flatMap((area) => area.geometry.coordinates[0] ?? []);
  if (!vertices.length) return MERIDA;
  const longitudes = vertices.map((point) => Number(point[0]));
  const latitudes = vertices.map((point) => Number(point[1]));
  return {
    bounds: [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ] as [[number, number], [number, number]],
    fitBoundsOptions: { padding: 40 },
  };
}

/** Click to place the point, drag the pin to adjust. Coordinates are never typed. */
export default function PointPickerMap({
  value,
  onChange,
  areas,
  source,
  onFailure,
  label,
}: Props) {
  const colors = useMapTheme();
  const mapStyle = useMemo(
    () => baseMapStyle(source),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the url and kind define the style.
    [source.url, source.isRaster],
  );
  const collection = {
    type: "FeatureCollection" as const,
    features: areas.map((area) => ({
      type: "Feature" as const,
      properties: { label: area.label },
      geometry: area.geometry,
    })),
  };
  return (
    <div className="relative h-80 w-full overflow-hidden rounded-xl border border-line">
      <Map
        initialViewState={initialView(value, areas)}
        mapStyle={mapStyle}
        maxZoom={MAX_MAP_ZOOM}
        workerUrl={workerUrl}
        attributionControl={false}
        cursor="crosshair"
        locale={{ "Map.Title": label }}
        onError={onFailure}
        onClick={(event) => {
          onChange([round(event.lngLat.lng), round(event.lngLat.lat)]);
        }}
      >
        <Source id="picker-areas" type="geojson" data={collection}>
          <Layer
            id="picker-fill"
            type="fill"
            paint={{ "fill-color": colors.action, "fill-opacity": 0.1 }}
          />
          <Layer
            id="picker-line"
            type="line"
            paint={{ "line-color": colors.action, "line-width": 2 }}
          />
        </Source>
        {value && (
          <Marker
            longitude={value[0] ?? 0}
            latitude={value[1] ?? 0}
            anchor="bottom"
            draggable
            onDragEnd={(event) => {
              onChange([round(event.lngLat.lng), round(event.lngLat.lat)]);
            }}
          >
            <MapPin
              aria-hidden="true"
              className="size-8 fill-action text-surface drop-shadow"
              strokeWidth={1.5}
            />
          </Marker>
        )}
        <MapAttribution source={source.attribution} />
      </Map>
    </div>
  );
}
