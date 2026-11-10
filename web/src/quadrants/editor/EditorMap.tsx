/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Map, { Layer, Marker, Source } from "react-map-gl/maplibre";
import type { MapLayerMouseEvent } from "react-map-gl/maplibre";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { baseMapStyle } from "../geography/map-features";
import { MAX_MAP_ZOOM, OSM_COPYRIGHT } from "../geography/map-source";
import type { MapSource } from "../geography/map-source";
import { useMapTheme } from "../geography/use-map-theme";
import type { EditorData } from "./use-editor-data";
import type { MapEditor } from "./use-map-editor";
import { editorFeatures, initialView } from "./editor-features";
import { centroid } from "./geo-math";
import { geometryOf } from "./editor-model";
import { createEditorDraw } from "./terra-draw";

const QUADRANT_FILL = "editor-quadrant-fill";
const FILL_OPACITY = 0.12;
const SELECTED_OPACITY = 0.28;
const POINT_RADIUS = 6;
const RELEASE_RADIUS = 7;
const DASH = [3, 2];

interface Props {
  data: EditorData;
  /** Quadrants the first view fits to. */
  viewQuadrants: EditorData["quadrants"];
  editor: MapEditor;
  source: MapSource;
  onFailure: () => void;
}

export default function EditorMap({ data, viewQuadrants, editor, source, onFailure }: Props) {
  const { t } = useTranslation();
  const colors = useMapTheme();
  const { draw, setDraw, tool, quadrantId, selectQuadrant } = editor;
  // A new style object would make MapLibre reload the style and drop the Terra Draw layers.
  const mapStyle = useMemo(
    () => baseMapStyle(source),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the url and kind define the style.
    [source.url, source.isRaster],
  );
  const hiddenBlocks = useMemo(
    () =>
      new Set(
        tool === "move" && quadrantId
          ? data.blocks.filter((item) => item.quadrant === quadrantId).map((item) => item.id)
          : [],
      ),
    [tool, quadrantId, data.blocks],
  );
  const collections = editorFeatures(data, quadrantId, {
    quadrant: tool === "move" ? quadrantId : null,
    blockIds: hiddenBlocks,
  });
  useEffect(
    () => () => {
      draw?.stop();
    },
    [draw],
  );
  const onClick = (event: MapLayerMouseEvent) => {
    if (tool !== "browse" && tool !== "move") return;
    const id: unknown = event.features?.[0]?.properties["id"];
    if (typeof id === "string") selectQuadrant(id);
  };
  const isDrawing = tool === "quadrant" || tool === "sampling" || tool === "release";
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-line bg-surface">
      <Map
        initialViewState={initialView(viewQuadrants)}
        mapStyle={mapStyle}
        maxZoom={MAX_MAP_ZOOM}
        workerUrl={workerUrl}
        attributionControl={false}
        doubleClickZoom={!isDrawing}
        interactiveLayerIds={[QUADRANT_FILL]}
        cursor={isDrawing ? "crosshair" : undefined}
        locale={{ "Map.Title": t("mapEditor.map.label") }}
        onError={onFailure}
        onClick={onClick}
        onLoad={(event) => {
          const instance = createEditorDraw(event.target, colors);
          instance.on("ready", () => {
            setDraw(instance);
          });
          instance.start();
        }}
      >
        <Source id="editor-polygons" type="geojson" data={collections.polygons}>
          <Layer
            id={QUADRANT_FILL}
            type="fill"
            filter={["==", ["get", "kind"], "quadrant"]}
            paint={{
              "fill-color": colors.action,
              "fill-opacity": ["case", ["get", "selected"], SELECTED_OPACITY, FILL_OPACITY],
            }}
          />
          <Layer
            id="editor-quadrant-solid"
            type="line"
            filter={[
              "all",
              ["==", ["get", "kind"], "quadrant"],
              ["==", ["get", "pattern"], "solid"],
            ]}
            paint={{
              "line-color": colors.action,
              "line-width": ["case", ["get", "selected"], 4, 2],
            }}
          />
          <Layer
            id="editor-quadrant-dashed"
            type="line"
            filter={[
              "all",
              ["==", ["get", "kind"], "quadrant"],
              ["==", ["get", "pattern"], "dashed"],
            ]}
            paint={{
              "line-color": colors.status.warning.fg,
              "line-width": ["case", ["get", "selected"], 4, 2],
              "line-dasharray": DASH,
            }}
          />
          <Layer
            id="editor-blocks"
            type="line"
            filter={["==", ["get", "kind"], "block"]}
            paint={{
              "line-color": colors.text.tertiary,
              "line-width": 1,
              "line-dasharray": [2, 2],
            }}
          />
        </Source>
        <Source id="editor-points" type="geojson" data={collections.points}>
          <Layer
            id="editor-sampling"
            type="circle"
            filter={["==", ["get", "kind"], "sampling"]}
            paint={{
              "circle-color": colors.action,
              "circle-radius": POINT_RADIUS,
              "circle-stroke-color": colors.surface,
              "circle-stroke-width": 2,
            }}
          />
          <Layer
            id="editor-release"
            type="circle"
            filter={["==", ["get", "kind"], "release"]}
            paint={{
              "circle-color": colors.surface,
              "circle-radius": RELEASE_RADIUS,
              "circle-stroke-color": colors.status.success.fg,
              "circle-stroke-width": 4,
            }}
          />
        </Source>
        {data.quadrants.map((item) => {
          const geometry = geometryOf(item);
          if (!geometry) return null;
          const [longitude, latitude] = centroid(geometry);
          return (
            <Marker key={item.id} longitude={longitude} latitude={latitude} anchor="center">
              <span className="pointer-events-none rounded-md bg-surface/90 px-1.5 py-0.5 text-xs font-bold text-ink shadow-card">
                {item.code}
              </span>
            </Marker>
          );
        })}
      </Map>
      <p className="absolute right-2 bottom-2 m-0 rounded bg-surface/90 px-2 py-0.5 text-xs text-ink-2">
        <a href={OSM_COPYRIGHT} target="_blank" rel="noreferrer">
          {t("geography.map.attribution")}
        </a>{" "}
        {source.attribution}
      </p>
    </div>
  );
}
