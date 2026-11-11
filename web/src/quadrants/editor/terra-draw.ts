/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawModeUndoRedo,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawRenderMode,
  TerraDrawSelectMode,
} from "terra-draw";
import type { GeoJSONStoreFeatures, HexColor } from "terra-draw";
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { lightTheme } from "@wolbachia/tokens";

type Colors = typeof lightTheme.color;

export const DRAW_MODES = {
  polygon: "polygon",
  /** Blocks are drawn by their own polygon mode so the line in progress already looks like a block. */
  block: "block",
  point: "point",
  select: "select",
  /** Throwaway measuring lines: never part of the draft, never saved. */
  ruler: "ruler",
  idle: "static",
} as const;

const hex = (value: string) => value as HexColor;
const OUTLINE_WIDTH = 3;
const SELECTED_WIDTH = 4;
const POINT_WIDTH = 8;
const VERTEX_WIDTH = 7;
const FILL_OPACITY = 0.18;
const BLOCK_FILL = 0.06;
/** Same look as the saved blocks of the static layer: thin, dashed, secondary text color. */
const BLOCK_WIDTH = 1.5;
const BLOCK_DASH = [2, 2];
const SOLID_DASH = [1, 0];
const DRAW_OUTLINE_LAYER = "td-polygon-outline";
/** Ruler: thin dotted gray, so it never looks like a quadrant or a block. */
const RULER_WIDTH = 1.5;
const RULER_DASH: [number, number] = [1, 2];
const RULER_POINT = 4;

/**
 * Terra Draw outlines are solid. Blocks (mode "block": drawing, editing and unsaved) get the
 * dash of the saved blocks. Call it when Terra Draw is ready (its layers exist then).
 */
export function dashBlockOutlines(map: MapLibreMap): void {
  if (!map.getLayer(DRAW_OUTLINE_LAYER)) return;
  map.setPaintProperty(DRAW_OUTLINE_LAYER, "line-dasharray", [
    "case",
    ["==", ["get", "mode"], DRAW_MODES.block],
    ["literal", BLOCK_DASH],
    ["literal", SOLID_DASH],
  ]);
}

const POLYGON_FLAGS = {
  feature: {
    draggable: true,
    coordinates: { draggable: true, midpoints: true, deletable: true },
  },
};

function pointColor(colors: Colors) {
  return (feature: GeoJSONStoreFeatures) =>
    hex(feature.properties["kind"] === "release" ? colors.status.success.fg : colors.action);
}

/** One Terra Draw instance per map: draw quadrants, place points, drag vertices and points. */
export function createEditorDraw(map: MapLibreMap, colors: Colors): TerraDraw {
  const polygonStyles = {
    fillColor: hex(colors.action),
    fillOpacity: FILL_OPACITY,
    outlineColor: hex(colors.action),
    outlineWidth: OUTLINE_WIDTH,
    closingPointColor: hex(colors.surface),
    closingPointOutlineColor: hex(colors.action),
    closingPointWidth: VERTEX_WIDTH,
    closingPointOutlineWidth: 2,
    coordinatePointColor: hex(colors.surface),
    coordinatePointOutlineColor: hex(colors.action),
    coordinatePointWidth: VERTEX_WIDTH,
    coordinatePointOutlineWidth: 2,
  };
  const blockStyles = {
    ...polygonStyles,
    fillColor: hex(colors.text.secondary),
    fillOpacity: BLOCK_FILL,
    outlineColor: hex(colors.text.secondary),
    outlineWidth: BLOCK_WIDTH,
    closingPointOutlineColor: hex(colors.text.secondary),
    coordinatePointOutlineColor: hex(colors.text.secondary),
  };
  const pointStyles = {
    pointColor: pointColor(colors),
    pointWidth: POINT_WIDTH,
    pointOutlineColor: hex(colors.surface),
    pointOutlineWidth: 2,
  };
  return new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map }),
    modes: [
      new TerraDrawPolygonMode({ styles: polygonStyles, showCoordinatePoints: true }),
      new TerraDrawPolygonMode({
        modeName: DRAW_MODES.block,
        styles: blockStyles,
        showCoordinatePoints: true,
      }),
      new TerraDrawPointMode({ styles: pointStyles }),
      new TerraDrawLineStringMode({
        modeName: DRAW_MODES.ruler,
        // Escape belongs to the editor: it clears every ruler line, not just the one in progress.
        keyEvents: { cancel: null, finish: "Enter" },
        showCoordinatePoints: true,
        styles: {
          lineStringColor: hex(colors.text.secondary),
          lineStringWidth: RULER_WIDTH,
          lineStringDash: RULER_DASH,
          closingPointColor: hex(colors.surface),
          closingPointOutlineColor: hex(colors.text.secondary),
          closingPointWidth: RULER_POINT,
          closingPointOutlineWidth: 1,
          coordinatePointColor: hex(colors.surface),
          coordinatePointOutlineColor: hex(colors.text.secondary),
          coordinatePointWidth: RULER_POINT,
          coordinatePointOutlineWidth: 1,
        },
      }),
      new TerraDrawSelectMode({
        // Delete and the shortcuts belong to the editor, not to Terra Draw.
        keyEvents: { deselect: "Escape", delete: null, rotate: null, scale: null },
        flags: {
          polygon: POLYGON_FLAGS,
          block: POLYGON_FLAGS,
          point: { feature: { draggable: true } },
        },
        styles: {
          selectedPolygonColor: hex(colors.action),
          selectedPolygonOutlineColor: hex(colors.actionStrong),
          selectedPolygonOutlineWidth: SELECTED_WIDTH,
          selectedPolygonFillOpacity: FILL_OPACITY,
          selectionPointColor: hex(colors.surface),
          selectionPointOutlineColor: hex(colors.actionStrong),
          selectionPointWidth: VERTEX_WIDTH,
          selectionPointOutlineWidth: 2,
          midPointColor: hex(colors.tint),
          midPointOutlineColor: hex(colors.action),
          selectedPointColor: hex(colors.status.warning.fg),
          selectedPointWidth: POINT_WIDTH,
          selectedPointOutlineColor: hex(colors.surface),
          selectedPointOutlineWidth: 2,
        },
      }),
      new TerraDrawRenderMode({ modeName: DRAW_MODES.idle, styles: {} }),
    ],
    undoRedo: { modeLevel: new TerraDrawModeUndoRedo() },
  });
}
