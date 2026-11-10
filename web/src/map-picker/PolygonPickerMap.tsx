/* eslint-disable max-lines-per-function -- one map: context areas and a Terra Draw shape. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Map, { Layer, Source } from "react-map-gl/maplibre";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import type { TerraDraw } from "terra-draw";
import { RotateCcw } from "lucide-react";
import { Button } from "../ui/Button";
import { baseMapStyle } from "../quadrants/geography/map-features";
import { MAX_MAP_ZOOM, OSM_COPYRIGHT } from "../quadrants/geography/map-source";
import type { MapSource } from "../quadrants/geography/map-source";
import type { Polygon } from "../quadrants/geography/geometry";
import { useMapTheme } from "../quadrants/geography/use-map-theme";
import { createEditorDraw, DRAW_MODES } from "../quadrants/editor/terra-draw";
import { roundPolygon } from "../quadrants/editor/geo-math";
import type { PickerArea } from "./picker-types";

const MERIDA = { longitude: -89.62, latitude: 20.97, zoom: 12 };

interface Props {
  value: Polygon | null;
  onChange: (polygon: Polygon | null) => void;
  areas: readonly PickerArea[];
  source: MapSource;
  onFailure: () => void;
  label: string;
}

function initialView(value: Polygon | null, areas: readonly PickerArea[]) {
  const vertices = [
    ...(value?.coordinates[0] ?? []),
    ...areas.flatMap((area) => area.geometry.coordinates[0] ?? []),
  ];
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

/** Click each corner, close on the first or last one, then drag corners to adjust. */
export default function PolygonPickerMap(props: Props) {
  const { value, onChange, areas, source, onFailure, label } = props;
  const { t } = useTranslation();
  const colors = useMapTheme();
  const [draw, setDraw] = useState<TerraDraw | null>(null);
  const initial = useRef(value);
  const change = useRef(onChange);
  change.current = onChange;
  const mapStyle = useMemo(
    () => baseMapStyle(source),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the url and kind define the style.
    [source.url, source.isRaster],
  );
  const start = (instance: TerraDraw) => {
    instance.clear();
    if (initial.current) {
      const id = String(instance.getFeatureId());
      instance.addFeatures([
        {
          id,
          type: "Feature",
          geometry: roundPolygon(initial.current),
          properties: { mode: DRAW_MODES.polygon },
        },
      ]);
      instance.setMode(DRAW_MODES.select);
      instance.selectFeature(id);
    } else instance.setMode(DRAW_MODES.polygon);
  };
  useEffect(() => {
    if (!draw) return;
    const onFinish = (id: string | number) => {
      const feature = draw.getSnapshotFeature(id);
      if (feature?.geometry.type !== "Polygon") return;
      change.current(roundPolygon({ type: "Polygon", coordinates: feature.geometry.coordinates }));
      if (draw.getMode() === DRAW_MODES.polygon) {
        draw.setMode(DRAW_MODES.select);
        draw.selectFeature(id);
      }
    };
    draw.on("finish", onFinish);
    return () => {
      draw.off("finish", onFinish);
      draw.stop();
    };
  }, [draw]);
  const collection = {
    type: "FeatureCollection" as const,
    features: areas.map((area) => ({
      type: "Feature" as const,
      properties: { label: area.label },
      geometry: area.geometry,
    })),
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-96 w-full overflow-hidden rounded-xl border border-line">
        <Map
          initialViewState={initialView(value, areas)}
          mapStyle={mapStyle}
          maxZoom={MAX_MAP_ZOOM}
          workerUrl={workerUrl}
          attributionControl={false}
          doubleClickZoom={false}
          locale={{ "Map.Title": label }}
          onError={onFailure}
          onLoad={(event) => {
            const instance = createEditorDraw(event.target, colors);
            instance.on("ready", () => {
              start(instance);
              setDraw(instance);
            });
            instance.start();
          }}
        >
          <Source id="polygon-picker-areas" type="geojson" data={collection}>
            <Layer
              id="polygon-picker-line"
              type="line"
              paint={{
                "line-color": colors.text.tertiary,
                "line-width": 2,
                "line-dasharray": [2, 2],
              }}
            />
          </Source>
        </Map>
        <p className="absolute right-2 bottom-1 m-0 rounded bg-surface/90 px-2 text-xs text-ink-2">
          <a href={OSM_COPYRIGHT} target="_blank" rel="noreferrer">
            {t("geography.map.attribution")}
          </a>{" "}
          {source.attribution}
        </p>
      </div>
      <div>
        <Button
          size="sm"
          variant="secondary"
          leadingIcon={<RotateCcw aria-hidden="true" />}
          disabled={!draw}
          onClick={() => {
            if (!draw) return;
            initial.current = null;
            onChange(null);
            start(draw);
          }}
        >
          {t("mapEditor.action.redraw")}
        </Button>
      </div>
    </div>
  );
}
