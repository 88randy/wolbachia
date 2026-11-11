/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { useEffect, useMemo, useState } from "react";
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
import type { ShapeKind } from "./editor-draft";
import { createEditorDraw } from "./terra-draw";

const QUADRANT_FILL = "editor-quadrant-fill";
const SAMPLING = "editor-sampling";
const RELEASE = "editor-release";
const BLOCK_HIT = "editor-blocks-hit";
const FILL_OPACITY = 0.12;
const HOVER_OPACITY = 0.24;
const POINT_RADIUS = 6;
const HOVER_RADIUS = 10;
const RELEASE_RADIUS = 7;
const DASH = [3, 2];
const POINT_KINDS: readonly ShapeKind[] = ["sampling", "release"];
const BLOCK_HIT_WIDTH = 12;

interface Props {
  data: EditorData;
  /** Quadrants the first view fits to. */
  viewQuadrants: EditorData["quadrants"];
  editor: MapEditor;
  source: MapSource;
  /** Saved quadrants and points may be picked and corrected (publish permission). */
  canEdit: boolean;
  onFailure: () => void;
}

function pickRecord(event: MapLayerMouseEvent): { id: string; kind: ShapeKind } | null {
  const hits = event.features ?? [];
  // A point wins over a block edge, and a block edge over the quadrant it sits in.
  const hit =
    hits.find((item) => POINT_KINDS.includes(item.properties["kind"] as ShapeKind)) ??
    hits.find((item) => item.properties["kind"] === "block") ??
    hits[0];
  const id: unknown = hit?.properties["id"];
  const kind: unknown = hit?.properties["kind"];
  return typeof id === "string" && typeof kind === "string"
    ? { id, kind: kind as ShapeKind }
    : null;
}

export default function EditorMap({
  data,
  viewQuadrants,
  editor,
  source,
  canEdit,
  onFailure,
}: Props) {
  const { t } = useTranslation();
  const colors = useMapTheme();
  const { setDraw, tool, load, shapes, mapRef } = editor;
  const [hovered, setHovered] = useState<string | null>(null);
  // A new style object would make MapLibre reload the style and drop the Terra Draw layers.
  const mapStyle = useMemo(
    () => baseMapStyle(source),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the url and kind define the style.
    [source.url, source.isRaster],
  );
  // Saved records the draft draws itself are skipped by the static layers.
  const hiddenIds = shapes
    .flatMap((item) => (item.saved ? [item.saved.recordId] : []))
    .sort()
    .join(",");
  const { quadrants, blocks, points, releasePoints } = data;
  const collections = useMemo(
    () =>
      editorFeatures(
        { quadrants, blocks, points, releasePoints },
        { recordIds: new Set(hiddenIds ? hiddenIds.split(",") : []) },
      ),
    [quadrants, blocks, points, releasePoints, hiddenIds],
  );
  const labels = useMemo(
    () =>
      quadrants.flatMap((item) => {
        const geometry = geometryOf(item);
        return geometry ? [{ id: item.id, code: item.code, at: centroid(geometry) }] : [];
      }),
    [quadrants],
  );
  useEffect(
    () => () => {
      editor.draw?.stop();
    },
    [editor.draw],
  );
  const isDrawing = tool !== "select";
  const onClick = (event: MapLayerMouseEvent) => {
    if (tool !== "select" || !canEdit) return;
    const record = pickRecord(event);
    if (record) load(record.kind, record.id);
  };
  const onMouseMove = (event: MapLayerMouseEvent) => {
    if (tool !== "select" || !canEdit) return;
    setHovered(pickRecord(event)?.id ?? null);
  };
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-line bg-surface">
      <Map
        initialViewState={initialView(viewQuadrants)}
        mapStyle={mapStyle}
        maxZoom={MAX_MAP_ZOOM}
        workerUrl={workerUrl}
        attributionControl={false}
        doubleClickZoom={!isDrawing}
        interactiveLayerIds={[QUADRANT_FILL, BLOCK_HIT, SAMPLING, RELEASE]}
        cursor={isDrawing ? "crosshair" : hovered ? "pointer" : undefined}
        locale={{ "Map.Title": t("mapEditor.map.label") }}
        onError={onFailure}
        onClick={onClick}
        onMouseMove={onMouseMove}
        onMouseOut={() => {
          setHovered(null);
        }}
        onLoad={(event) => {
          mapRef.current = event.target;
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
              "fill-opacity": [
                "case",
                ["==", ["get", "id"], hovered ?? ""],
                HOVER_OPACITY,
                FILL_OPACITY,
              ],
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
              "line-width": ["case", ["==", ["get", "id"], hovered ?? ""], 4, 2],
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
              "line-width": ["case", ["==", ["get", "id"], hovered ?? ""], 4, 2],
              "line-dasharray": DASH,
            }}
          />
          <Layer
            id={BLOCK_HIT}
            type="line"
            filter={["==", ["get", "kind"], "block"]}
            paint={{
              "line-color": colors.surface,
              "line-opacity": 0,
              "line-width": BLOCK_HIT_WIDTH,
            }}
          />
          <Layer
            id="editor-blocks"
            type="line"
            filter={["==", ["get", "kind"], "block"]}
            paint={{
              "line-color": colors.text.secondary,
              "line-width": ["case", ["==", ["get", "id"], hovered ?? ""], 3, 1.5],
              "line-dasharray": [2, 2],
            }}
          />
        </Source>
        <Source id="editor-points" type="geojson" data={collections.points}>
          <Layer
            id="editor-point-halo"
            type="circle"
            filter={["all", ["!=", ["get", "kind"], "block"], ["==", ["get", "id"], hovered ?? ""]]}
            paint={{
              "circle-color": colors.tint,
              "circle-radius": HOVER_RADIUS,
              "circle-stroke-color": colors.actionStrong,
              "circle-stroke-width": 2,
            }}
          />
          <Layer
            id={SAMPLING}
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
            id={RELEASE}
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
        {labels.map((item) => (
          <Marker key={item.id} longitude={item.at[0]} latitude={item.at[1]} anchor="center">
            <span className="pointer-events-none rounded-md bg-surface/90 px-1.5 py-0.5 text-xs font-bold text-ink shadow-card">
              {item.code}
            </span>
          </Marker>
        ))}
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
