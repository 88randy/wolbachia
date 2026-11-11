/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw wiring, split after the demo. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Map from "react-map-gl/maplibre";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Schemas } from "@wolbachia/api-client";
import type { TerraDraw } from "terra-draw";
import { Button } from "../../ui/Button";
import { baseMapStyle } from "../../quadrants/geography/map-features";
import { MAX_MAP_ZOOM } from "../../quadrants/geography/map-source";
import type { MapSource } from "../../quadrants/geography/map-source";
import { MapAttribution } from "../../quadrants/geography/MapAttribution";
import { useMapTheme } from "../../quadrants/geography/use-map-theme";
import { initialView } from "../../quadrants/editor/editor-features";
import { roundPolygon } from "../../quadrants/editor/geo-math";
import { createEditorDraw, DRAW_MODES } from "../../quadrants/editor/terra-draw";
import type { PolygonBody } from "./permit-geometry";

interface Props {
  source: MapSource;
  quadrants: readonly Schemas["Quadrant"][];
  zone: PolygonBody | null;
  onZone: (zone: PolygonBody | null) => void;
  onFailure: () => void;
}

function polygonOf(draw: TerraDraw, id: string | number): PolygonBody | null {
  const feature = draw.getSnapshotFeature(id);
  if (feature?.geometry.type !== "Polygon") return null;
  const rounded = roundPolygon({ type: "Polygon", coordinates: feature.geometry.coordinates });
  return { type: "Polygon", coordinates: rounded.coordinates };
}

/** Draw the permit zone on the map with Terra Draw: click the corners, close the shape, drag to adjust. */
export default function ZoneDrawMap({ source, quadrants, zone, onZone, onFailure }: Props) {
  const { t } = useTranslation();
  const colors = useMapTheme();
  const drawRef = useRef<TerraDraw | null>(null);
  const [isDrawing, setDrawing] = useState(zone === null);
  const mapStyle = useMemo(
    () => baseMapStyle(source),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the url and kind define the style.
    [source.url, source.isRaster],
  );
  const view = useMemo(() => initialView(quadrants), [quadrants]);
  useEffect(
    () => () => {
      drawRef.current?.stop();
    },
    [],
  );
  const redraw = () => {
    const draw = drawRef.current;
    if (!draw) return;
    draw.clear();
    draw.setMode(DRAW_MODES.polygon);
    setDrawing(true);
    onZone(null);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="h-80 overflow-hidden rounded-xl border border-line">
        <Map
          initialViewState={view}
          mapStyle={mapStyle}
          maxZoom={MAX_MAP_ZOOM}
          workerUrl={workerUrl}
          attributionControl={false}
          cursor={isDrawing ? "crosshair" : undefined}
          doubleClickZoom={false}
          locale={{ "Map.Title": t("permits.zone.mapLabel") }}
          onError={onFailure}
          onLoad={(event) => {
            const draw = createEditorDraw(event.target, colors);
            drawRef.current = draw;
            draw.on("ready", () => {
              if (zone === null) {
                draw.setMode(DRAW_MODES.polygon);
                return;
              }
              draw.addFeatures([
                {
                  type: "Feature",
                  geometry: zone,
                  properties: { mode: DRAW_MODES.polygon },
                },
              ]);
              draw.setMode(DRAW_MODES.select);
            });
            draw.on("finish", (id, context) => {
              if (context.mode !== DRAW_MODES.polygon) return;
              onZone(polygonOf(draw, id));
              draw.setMode(DRAW_MODES.select);
              draw.selectFeature(id);
              setDrawing(false);
            });
            draw.on("change", (ids, type) => {
              const id = ids[0];
              if (type === "update" && id !== undefined && draw.getMode() === DRAW_MODES.select)
                onZone(polygonOf(draw, id));
            });
            draw.start();
          }}
        >
          <MapAttribution source={source.attribution} />
        </Map>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-xs text-ink-2">
          {t(isDrawing ? "permits.zone.drawHint" : "permits.zone.adjustHint")}
        </p>
        <Button variant="tertiary" size="sm" onClick={redraw}>
          {t("permits.zone.redraw")}
        </Button>
      </div>
    </div>
  );
}
