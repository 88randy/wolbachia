/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import {
  TerraDraw,
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
  point: "point",
  select: "select",
  idle: "static",
} as const;

const hex = (value: string) => value as HexColor;
const OUTLINE_WIDTH = 3;
const SELECTED_WIDTH = 4;
const POINT_WIDTH = 8;
const VERTEX_WIDTH = 7;
const FILL_OPACITY = 0.18;
const BLOCK_FILL = 0.06;
const BLOCK_WIDTH = 2;

const isBlock = (feature: GeoJSONStoreFeatures) => feature.properties["kind"] === "block";

function pointColor(colors: Colors) {
  return (feature: GeoJSONStoreFeatures) =>
    hex(feature.properties["kind"] === "release" ? colors.status.success.fg : colors.action);
}

/** One Terra Draw instance per map: draw quadrants, place points, drag vertices and points. */
export function createEditorDraw(map: MapLibreMap, colors: Colors): TerraDraw {
  const polygonStyles = {
    fillColor: (feature: GeoJSONStoreFeatures) =>
      hex(isBlock(feature) ? colors.actionStrong : colors.action),
    fillOpacity: (feature: GeoJSONStoreFeatures) => (isBlock(feature) ? BLOCK_FILL : FILL_OPACITY),
    outlineColor: (feature: GeoJSONStoreFeatures) =>
      hex(isBlock(feature) ? colors.actionStrong : colors.action),
    outlineWidth: (feature: GeoJSONStoreFeatures) =>
      isBlock(feature) ? BLOCK_WIDTH : OUTLINE_WIDTH,
    closingPointColor: hex(colors.surface),
    closingPointOutlineColor: hex(colors.action),
    closingPointWidth: VERTEX_WIDTH,
    closingPointOutlineWidth: 2,
    coordinatePointColor: hex(colors.surface),
    coordinatePointOutlineColor: hex(colors.action),
    coordinatePointWidth: VERTEX_WIDTH,
    coordinatePointOutlineWidth: 2,
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
      new TerraDrawPointMode({ styles: pointStyles }),
      new TerraDrawSelectMode({
        // Delete and the shortcuts belong to the editor, not to Terra Draw.
        keyEvents: { deselect: "Escape", delete: null, rotate: null, scale: null },
        flags: {
          polygon: {
            feature: {
              draggable: true,
              coordinates: { draggable: true, midpoints: true, deletable: true },
            },
          },
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
