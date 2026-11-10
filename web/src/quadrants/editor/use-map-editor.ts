/* eslint-disable max-lines-per-function, complexity -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { GeoJSONStoreFeatures, TerraDraw } from "terra-draw";

type FeatureId = string | number;
import type { Polygon } from "../geography/geometry";
import type { EditorData } from "./use-editor-data";
import type { EditorTool, EditTarget, PointDraft, PointKind, QuadrantDraft } from "./editor-model";
import { geometryOf } from "./editor-model";
import { roundPolygon, roundPosition } from "./geo-math";
import { DRAW_MODES } from "./terra-draw";

type Snapshot = GeoJSONStoreFeatures;

function polygonOf(feature: Snapshot | undefined): Polygon | null {
  return feature?.geometry.type === "Polygon"
    ? roundPolygon({ type: "Polygon", coordinates: feature.geometry.coordinates })
    : null;
}

function locationOf(feature: Snapshot | undefined): number[] | null {
  return feature?.geometry.type === "Point" ? roundPosition(feature.geometry.coordinates) : null;
}

/** Tool state and Terra Draw events. Writes live in `use-editor-saves`. */
export function useMapEditor(data: EditorData) {
  const [draw, setDraw] = useState<TerraDraw | null>(null);
  const [tool, setToolState] = useState<EditorTool>("browse");
  const [quadrantId, setQuadrantId] = useState<string | null>(null);
  const [quadrantDraft, setQuadrantDraft] = useState<QuadrantDraft | null>(null);
  const [pointDraft, setPointDraft] = useState<PointDraft | null>(null);
  const [editPolygon, setEditPolygon] = useState<Polygon | null>(null);
  const [moved, setMoved] = useState<Record<string, number[]>>({});
  const [vertexCount, setVertexCount] = useState(0);
  const targets = useRef(new Map<string, EditTarget>());
  const pointDraftRef = useRef<PointDraft | null>(null);
  const toolRef = useRef<EditorTool>("browse");

  const resetDraw = useCallback(() => {
    if (!draw) return;
    draw.setMode(DRAW_MODES.idle);
    draw.clear();
    targets.current.clear();
    pointDraftRef.current = null;
    setQuadrantDraft(null);
    setPointDraft(null);
    setEditPolygon(null);
    setMoved({});
    setVertexCount(0);
  }, [draw]);

  const loadForMove = useCallback(
    (id: string) => {
      if (!draw) return;
      const quadrant = data.quadrants.find((item) => item.id === id);
      const geometry = quadrant ? geometryOf(quadrant) : null;
      if (!quadrant || !geometry) return;
      const polygon = roundPolygon(geometry);
      const features: Snapshot[] = [];
      const add = (target: EditTarget, feature: Omit<Snapshot, "id" | "type">) => {
        const featureId = String(draw.getFeatureId());
        targets.current.set(featureId, target);
        features.push({ ...feature, id: featureId, type: "Feature" });
      };
      add(
        {
          kind: "quadrant",
          recordId: quadrant.id,
          revision: quadrant.current_version?.revision ?? 0,
          original: polygon,
        },
        { geometry: polygon, properties: { mode: DRAW_MODES.polygon, kind: "quadrant" } },
      );
      const blockIds = new Set(
        data.blocks.filter((item) => item.quadrant === id).map((item) => item.id),
      );
      for (const point of data.points)
        if (blockIds.has(point.block) && point.current_version)
          add(
            {
              kind: "sampling",
              recordId: point.id,
              revision: point.current_version.version,
              original: point.current_version.location,
            },
            {
              geometry: {
                type: "Point",
                coordinates: roundPosition(point.current_version.location),
              },
              properties: { mode: DRAW_MODES.point, kind: "sampling" },
            },
          );
      for (const point of data.releasePoints)
        if (point.quadrant === id && point.current_version)
          add(
            {
              kind: "release",
              recordId: point.id,
              revision: point.current_version.version,
              original: point.current_version.location,
            },
            {
              geometry: {
                type: "Point",
                coordinates: roundPosition(point.current_version.location),
              },
              properties: { mode: DRAW_MODES.point, kind: "release" },
            },
          );
      draw.addFeatures(features);
      draw.setMode(DRAW_MODES.select);
      // The quadrant starts selected so its corners can be dragged right away.
      if (features[0]) draw.selectFeature(features[0].id ?? "");
      setEditPolygon(polygon);
    },
    [draw, data.quadrants, data.blocks, data.points, data.releasePoints],
  );

  const setTool = useCallback(
    (next: EditorTool) => {
      resetDraw();
      toolRef.current = next;
      setToolState(next);
      if (!draw) return;
      if (next === "quadrant") draw.setMode(DRAW_MODES.polygon);
      if (next === "sampling" || next === "release") draw.setMode(DRAW_MODES.point);
      if (next === "move" && quadrantId) loadForMove(quadrantId);
    },
    [draw, resetDraw, quadrantId, loadForMove],
  );

  const selectQuadrant = useCallback(
    (id: string | null) => {
      setQuadrantId(id);
      if (toolRef.current === "move") {
        resetDraw();
        if (id) loadForMove(id);
      }
    },
    [resetDraw, loadForMove],
  );

  useEffect(() => {
    if (!draw) return;
    const onFinish = (id: FeatureId, context: { mode: string }) => {
      const featureId = String(id);
      const feature = draw.getSnapshotFeature(id);
      if (context.mode === DRAW_MODES.polygon) {
        const polygon = polygonOf(feature);
        if (!polygon) return;
        setQuadrantDraft({ featureId, polygon, isClosed: true });
        setVertexCount(0);
        draw.setMode(DRAW_MODES.select);
        draw.selectFeature(id);
        return;
      }
      if (context.mode === DRAW_MODES.point) {
        const location = locationOf(feature);
        const kind: PointKind = toolRef.current === "release" ? "release" : "sampling";
        if (!location) return;
        const previous = pointDraftRef.current;
        if (previous && draw.hasFeature(previous.featureId))
          draw.removeFeatures([previous.featureId]);
        draw.updateFeatureProperties(id, { kind });
        const next = { featureId, kind, location };
        pointDraftRef.current = next;
        setPointDraft(next);
        return;
      }
      // Select mode: a vertex or a point was dragged.
      const target = targets.current.get(featureId);
      if (target?.kind === "quadrant") setEditPolygon(polygonOf(feature));
      else if (target) {
        const location = locationOf(feature);
        if (location) setMoved((current) => ({ ...current, [featureId]: location }));
      } else {
        const polygon = polygonOf(feature);
        if (polygon) setQuadrantDraft({ featureId, polygon, isClosed: true });
      }
    };
    const onChange = (_ids: FeatureId[], type: string) => {
      if (draw.getMode() !== DRAW_MODES.polygon || type === "delete") return;
      const drawing = draw
        .getSnapshot()
        .find((item) => item.properties["mode"] === DRAW_MODES.polygon && !item.properties["kind"]);
      const ring = drawing?.geometry.type === "Polygon" ? drawing.geometry.coordinates[0] : [];
      // An open ring repeats the cursor and closing positions.
      setVertexCount(Math.max((ring?.length ?? 0) - 2, 0));
    };
    draw.on("finish", onFinish);
    draw.on("change", onChange);
    return () => {
      draw.off("finish", onFinish);
      draw.off("change", onChange);
    };
  }, [draw]);

  const undo = useCallback(() => {
    if (!draw) return;
    if (tool === "quadrant" && quadrantDraft) {
      setTool("quadrant");
      return;
    }
    if (draw.canUndo()) draw.undo();
  }, [draw, tool, quadrantDraft, setTool]);

  const target = (featureId: string) => targets.current.get(featureId);

  return {
    draw,
    setDraw,
    tool,
    setTool,
    quadrantId,
    selectQuadrant,
    quadrantDraft,
    pointDraft,
    editPolygon,
    moved,
    target,
    targets: targets.current,
    vertexCount,
    undo,
    reset: () => {
      setTool(toolRef.current);
    },
  };
}

export type MapEditor = ReturnType<typeof useMapEditor>;
