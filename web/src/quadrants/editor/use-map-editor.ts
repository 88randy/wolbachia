/* eslint-disable max-lines-per-function, complexity, max-depth, max-params -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GeoJSONStoreFeatures, TerraDraw } from "terra-draw";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useToast } from "../../ui/toast-context";
import type { EditorData } from "./use-editor-data";
import type { EditorTool, PointKind } from "./editor-model";
import { geometryOf, nextCode } from "./editor-model";
import { holdingBlock, holdingQuadrant, vertices } from "./editor-places";
import { autoBlockOwner } from "./editor-plan";
import type { Draft, DraftShape, History, HistoryAction, ShapeKind } from "./editor-draft";
import {
  changedShapes,
  historyReducer,
  INITIAL_HISTORY,
  patchShape,
  removeShapes,
  upsertShape,
  EMPTY_DRAFT,
} from "./editor-draft";
import { DRAFT_FLAG, featureOf, roundedGeometry, syncDraw } from "./draw-sync";
import { roundPolygon, roundPosition } from "./geo-math";
import { shapeBounds } from "./editor-features";
import { DRAW_MODES } from "./terra-draw";

const MIN_CORNERS_OPEN_RING = 2;
const FIT_PADDING = 56;

function modeFor(tool: EditorTool): string {
  if (tool === "quadrant") return DRAW_MODES.polygon;
  if (tool === "block") return DRAW_MODES.block;
  if (tool === "sampling" || tool === "release") return DRAW_MODES.point;
  if (tool === "measure") return DRAW_MODES.ruler;
  return DRAW_MODES.select;
}

/** Drop every ruler line; they live only in Terra Draw, never in the draft. Returns how many. */
function removeRulerLines(draw: TerraDraw): number {
  const ids = draw
    .getSnapshot()
    // Only the lines: their corner markers go with them (deleting both throws).
    .filter(
      (item) => item.properties["mode"] === DRAW_MODES.ruler && item.geometry.type === "LineString",
    )
    .map((item) => item.id)
    .filter((id): id is string | number => id !== undefined);
  if (ids.length) draw.removeFeatures(ids);
  return ids.length;
}

/** Suggested name of a new shape, counting the names already used in the draft. */
function suggestCode(
  kind: ShapeKind,
  geometry: DraftShape["geometry"],
  data: EditorData,
  shapes: readonly DraftShape[],
): string {
  const drafted = (of: ShapeKind, prefix = "") =>
    shapes
      .filter((item) => item.kind === of && !item.saved && item.code.startsWith(prefix))
      .map((item) => item.code);
  if (kind === "quadrant")
    return nextCode([...data.quadrants.map((item) => item.code), ...drafted("quadrant")], "C-");
  if (geometry.type === "Polygon") {
    const parent = holdingQuadrant(data, shapes, vertices(geometry));
    const prefix = `${parent?.code ?? "M"}-M`;
    const codes = data.blocks.map((item) => item.code).filter((code) => code.startsWith(prefix));
    return nextCode([...codes, ...drafted("block", prefix)], prefix);
  }
  const location = geometry.coordinates;
  if (kind === "release") {
    const quadrant = holdingQuadrant(data, shapes, [location]);
    const prefix = `${quadrant?.code ?? "PL"}-REL-P`;
    const codes = data.releasePoints
      .filter((item) => quadrant && "id" in quadrant.ref && item.quadrant === quadrant.ref.id)
      .map((item) => item.code);
    return nextCode([...codes, ...drafted("release", prefix)], prefix);
  }
  const block = holdingBlock(data, shapes, location);
  const owner = block ? undefined : autoBlockOwner(data, shapes, location);
  const prefix = `${block?.code ?? (owner ? `${owner.code}-M1` : "P")}-P`;
  const codes = data.points
    .filter((item) => block && "id" in block.ref && item.block === block.ref.id)
    .map((item) => item.code);
  return nextCode([...codes, ...drafted("sampling", prefix)], prefix);
}

/** Tool state, the single draft session with its undo history, and the Terra Draw events. */
export function useMapEditor(data: EditorData) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [draw, setDraw] = useState<TerraDraw | null>(null);
  const [tool, setToolState] = useState<EditorTool>("select");
  const [history, setHistory] = useState<History>(INITIAL_HISTORY);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [vertexCount, setVertexCount] = useState(0);
  /** Bumped when ruler lines are removed: Terra Draw emits no change event for that. */
  const [rulerRevision, setRulerRevision] = useState(0);
  const mapRef = useRef<MapLibreMap | null>(null);
  const historyRef = useRef(history);
  const toolRef = useRef(tool);
  const dataRef = useRef(data);
  const mirrored = useRef<Draft | null>(null);
  const selectedRef = useRef<string | null>(null);
  const vertexRef = useRef(0);
  dataRef.current = data;

  const apply = useCallback((action: HistoryAction) => {
    const next = historyReducer(historyRef.current, action);
    if (next === historyRef.current) return;
    historyRef.current = next;
    setHistory(next);
  }, []);
  /** The change already happened on the map: record it without redrawing. */
  const record = useCallback(
    (next: Draft, mode: "commit" | "replace") => {
      mirrored.current = next;
      apply({ type: mode, next });
    },
    [apply],
  );
  const present = history.present;
  const presentNow = () => historyRef.current.present;

  const deselect = useCallback((instance: TerraDraw) => {
    const key = selectedRef.current;
    if (key && instance.getSnapshot().some((item) => item.id === key && item.properties.selected))
      instance.deselectFeature(key);
  }, []);

  // Undo, redo, discard and removal redraw the map from the draft.
  useEffect(() => {
    if (!draw || mirrored.current === present) return;
    mirrored.current = present;
    deselect(draw);
    syncDraw(draw, present.shapes);
  }, [draw, present, deselect]);

  const setTool = useCallback(
    (next: EditorTool) => {
      toolRef.current = next;
      setToolState(next);
      vertexRef.current = 0;
      setVertexCount(0);
      if (!draw) return;
      // Leaving the ruler ends its line in progress and clears every ruler line.
      if (draw.getMode() === DRAW_MODES.ruler) {
        draw.setMode(DRAW_MODES.idle);
        if (removeRulerLines(draw) > 0) setRulerRevision((current) => current + 1);
      }
      draw.setMode(modeFor(next));
    },
    [draw],
  );

  /** Bring a saved quadrant or point into the draft so it can be edited. */
  const load = useCallback(
    (kind: ShapeKind, recordId: string, select = true) => {
      if (!draw) return;
      const existing = presentNow().shapes.find((item) => item.saved?.recordId === recordId);
      let key = existing?.key;
      if (!existing) {
        const source = dataRef.current;
        let shape: DraftShape | null = null;
        if (kind === "quadrant") {
          const record = source.quadrants.find((item) => item.id === recordId);
          const geometry = record ? geometryOf(record) : null;
          if (record && geometry)
            shape = {
              key: String(draw.getFeatureId()),
              kind,
              geometry: roundPolygon(geometry),
              code: record.code,
              centerId: record.center,
              saved: {
                recordId,
                revision: record.current_version?.revision ?? 0,
                code: record.code,
                original: roundPolygon(geometry),
              },
            };
        } else if (kind === "block") {
          const record = source.blocks.find((item) => item.id === recordId);
          const geometry = record ? geometryOf(record) : null;
          if (record && geometry)
            shape = {
              key: String(draw.getFeatureId()),
              kind,
              geometry: roundPolygon(geometry),
              code: record.code,
              centerId: "",
              saved: {
                recordId,
                revision: record.current_version?.revision ?? 0,
                code: record.code,
                original: roundPolygon(geometry),
              },
            };
        } else {
          const record = (kind === "sampling" ? source.points : source.releasePoints).find(
            (item) => item.id === recordId,
          );
          const version = record?.current_version;
          if (record && version) {
            const point = { type: "Point" as const, coordinates: roundPosition(version.location) };
            shape = {
              key: String(draw.getFeatureId()),
              kind,
              geometry: point,
              code: record.code,
              centerId: "",
              saved: { recordId, revision: version.version, code: record.code, original: point },
            };
          }
        }
        if (!shape) return;
        key = shape.key;
        draw.addFeatures([featureOf(shape)]);
        record(upsertShape(presentNow(), shape), "replace");
      }
      if (!select || !key) return;
      if (toolRef.current !== "select") setTool("select");
      draw.setMode(DRAW_MODES.select);
      draw.selectFeature(key);
    },
    [draw, record, setTool],
  );

  useEffect(() => {
    if (!draw) return;
    const onFinish = (id: string | number, context: { mode: string }) => {
      // The ruler only measures: its lines never enter the draft, the undo steps or a save.
      if (context.mode === DRAW_MODES.ruler) return;
      const key = String(id);
      const feature = draw.getSnapshotFeature(id);
      const geometry = feature ? roundedGeometry(feature.geometry) : null;
      if (!feature || !geometry) return;
      const shapes = presentNow().shapes;
      const known = shapes.find((item) => item.key === key);
      if (known) {
        if (JSON.stringify(known.geometry) === JSON.stringify(geometry)) return;
        record(upsertShape(presentNow(), { ...known, geometry }), "commit");
        return;
      }
      if (
        (context.mode === DRAW_MODES.polygon || context.mode === DRAW_MODES.block) &&
        geometry.type === "Polygon"
      ) {
        const polygonKind: ShapeKind = context.mode === DRAW_MODES.block ? "block" : "quadrant";
        const shape: DraftShape = {
          key,
          kind: polygonKind,
          geometry,
          code: suggestCode(polygonKind, geometry, dataRef.current, shapes),
          centerId: polygonKind === "quadrant" ? (dataRef.current.centers[0]?.id ?? "") : "",
          saved: null,
        };
        draw.updateFeatureProperties(id, { kind: polygonKind, [DRAFT_FLAG]: true });
        record(upsertShape(presentNow(), shape), "commit");
        // The new quadrant stays selected so its corners can be adjusted right away.
        toolRef.current = "select";
        setToolState("select");
        vertexRef.current = 0;
        setVertexCount(0);
        draw.setMode(DRAW_MODES.select);
        draw.selectFeature(id);
        return;
      }
      if (context.mode === DRAW_MODES.point && geometry.type === "Point") {
        const kind: PointKind = toolRef.current === "release" ? "release" : "sampling";
        const shape: DraftShape = {
          key,
          kind,
          geometry,
          code: suggestCode(kind, geometry, dataRef.current, shapes),
          centerId: "",
          saved: null,
        };
        draw.updateFeatureProperties(id, { kind, [DRAFT_FLAG]: true });
        record(upsertShape(presentNow(), shape), "commit");
      }
    };
    const onChange = () => {
      const mode = draw.getMode();
      if (mode !== DRAW_MODES.polygon && mode !== DRAW_MODES.block) return;
      const drawing = draw
        .getSnapshot()
        .find(
          (item: GeoJSONStoreFeatures) =>
            item.properties["mode"] === mode && !item.properties[DRAFT_FLAG],
        );
      const ring = drawing?.geometry.type === "Polygon" ? drawing.geometry.coordinates[0] : [];
      // An open ring repeats the cursor and closing positions.
      const count = Math.max((ring?.length ?? 0) - MIN_CORNERS_OPEN_RING, 0);
      if (count === vertexRef.current) return;
      vertexRef.current = count;
      setVertexCount(count);
    };
    const onSelect = (id: string | number) => {
      const key = String(id);
      if (!presentNow().shapes.some((item) => item.key === key)) return;
      selectedRef.current = key;
      setSelectedKey(key);
    };
    const onDeselect = () => {
      selectedRef.current = null;
      setSelectedKey(null);
    };
    draw.on("finish", onFinish);
    draw.on("change", onChange);
    draw.on("select", onSelect);
    draw.on("deselect", onDeselect);
    return () => {
      draw.off("finish", onFinish);
      draw.off("change", onChange);
      draw.off("select", onSelect);
      draw.off("deselect", onDeselect);
    };
  }, [draw, record]);

  const undo = useCallback(() => {
    // While a polygon is still being clicked, undo takes back its last corner.
    if (draw && vertexRef.current > 0 && draw.canUndo()) {
      draw.undo();
      return;
    }
    apply({ type: "undo" });
  }, [draw, apply]);
  const redo = useCallback(() => {
    if (draw && vertexRef.current > 0 && draw.canRedo()) {
      draw.redo();
      return;
    }
    apply({ type: "redo" });
  }, [draw, apply]);

  /** Escape: drop the polygon being drawn (the finished shapes stay). */
  const cancelDrawing = useCallback(() => {
    if (!draw) return;
    draw.setMode(DRAW_MODES.idle);
    draw.setMode(modeFor(toolRef.current));
    vertexRef.current = 0;
    setVertexCount(0);
  }, [draw]);

  /** Escape with the ruler: clear its lines, or leave the ruler when there are none. */
  const clearRuler = useCallback(() => {
    if (!draw) return;
    draw.setMode(DRAW_MODES.idle);
    const removed = removeRulerLines(draw);
    if (removed > 0) setRulerRevision((current) => current + 1);
    if (removed === 0) {
      toolRef.current = "select";
      setToolState("select");
      draw.setMode(DRAW_MODES.select);
      return;
    }
    draw.setMode(DRAW_MODES.ruler);
  }, [draw]);

  /** Enter: Terra Draw closes the polygon (or ends the ruler line) on a key event from its canvas. */
  const finishDrawing = useCallback(() => {
    const canvas = mapRef.current?.getCanvas();
    if (canvas && (vertexRef.current >= 3 || toolRef.current === "measure"))
      canvas.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter" }));
  }, []);

  const removeShape = useCallback(
    (key: string, withUndo = true) => {
      const shape = presentNow().shapes.find((item) => item.key === key);
      if (!shape) return;
      if (shape.saved) {
        // Nothing saved is ever deleted: it is retired from its record with a reason.
        showToast({ message: t("mapEditor.delete.saved"), tone: "warning" });
        return;
      }
      apply({ type: "commit", next: removeShapes(presentNow(), new Set([key])) });
      if (withUndo)
        showToast({
          message: t("mapEditor.delete.done"),
          tone: "info",
          action: {
            label: t("mapEditor.action.undoStep"),
            onAction: () => {
              apply({ type: "undo" });
            },
          },
        });
    },
    [apply, showToast, t],
  );

  const revertShape = useCallback(
    (key: string) => {
      const shape = presentNow().shapes.find((item) => item.key === key);
      if (!shape?.saved) return;
      apply({
        type: "commit",
        next: patchShape(presentNow(), key, { geometry: shape.saved.original }),
      });
    },
    [apply],
  );

  const discardAll = useCallback(() => {
    if (!presentNow().shapes.length) return;
    apply({ type: "commit", next: EMPTY_DRAFT });
    showToast({
      message: t("mapEditor.discard.done"),
      tone: "info",
      action: {
        label: t("mapEditor.action.undoStep"),
        onAction: () => {
          apply({ type: "undo" });
        },
      },
    });
  }, [apply, showToast, t]);

  const updateShape = useCallback(
    (key: string, patch: Partial<Pick<DraftShape, "code" | "centerId">>) => {
      record(patchShape(presentNow(), key, patch), "replace");
    },
    [record],
  );

  /** After a save: the saved shapes leave the draft and the undo steps start over. */
  const settle = useCallback((keys: ReadonlySet<string>) => {
    const next = removeShapes(presentNow(), keys);
    historyRef.current = { present: next, past: [], future: [] };
    setHistory(historyRef.current);
  }, []);

  const select = useCallback(
    (key: string) => {
      if (!draw) return;
      if (toolRef.current !== "select") setTool("select");
      draw.setMode(DRAW_MODES.select);
      draw.selectFeature(key);
    },
    [draw, setTool],
  );

  const fit = useCallback((extra?: readonly DraftShape[]) => {
    const bounds = shapeBounds(dataRef.current.quadrants, extra ?? presentNow().shapes);
    if (bounds && mapRef.current)
      mapRef.current.fitBounds(bounds, { padding: FIT_PADDING, duration: 400, maxZoom: 18 });
  }, []);

  /** Zoom to one quadrant (and keep the draft in view when it is empty). */
  const fitQuadrant = useCallback((recordId: string) => {
    const record = dataRef.current.quadrants.find((item) => item.id === recordId);
    const geometry = record ? geometryOf(record) : null;
    const bounds = geometry ? shapeBounds([], [{ geometry }]) : null;
    if (bounds && mapRef.current)
      mapRef.current.fitBounds(bounds, { padding: FIT_PADDING, duration: 400, maxZoom: 18 });
  }, []);

  const pending = useMemo(() => changedShapes(present), [present]);
  const selected = present.shapes.find((item) => item.key === selectedKey) ?? null;

  return {
    draw,
    setDraw,
    mapRef,
    tool,
    setTool,
    shapes: present.shapes,
    pending,
    pendingCount: pending.length,
    selected,
    selectedKey,
    vertexCount,
    rulerRevision,
    canUndo: history.past.length > 0 || vertexCount > 0,
    canRedo: history.future.length > 0,
    undo,
    redo,
    load,
    select,
    removeShape,
    revertShape,
    discardAll,
    updateShape,
    settle,
    cancelDrawing,
    clearRuler,
    finishDrawing,
    fit,
    fitQuadrant,
  };
}

export type MapEditor = ReturnType<typeof useMapEditor>;
