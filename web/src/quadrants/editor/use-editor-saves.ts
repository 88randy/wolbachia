/* eslint-disable max-lines-per-function, complexity, max-depth -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { useToast } from "../../ui/toast-context";
import type { GeographyScope } from "../geography/use-w-15";
import { useGeographyWrite } from "../geography/use-geography-write";
import type { WriteOutcome } from "../geography/write-result";
import type { MapEditor } from "./use-map-editor";
import type { EditorData } from "./use-editor-data";
import { buildPlan, outsidePoints, shapeIssues } from "./editor-plan";
import type { OutsideDecision, PlanStep, Ref } from "./editor-plan";

const FIELD_KEYS: Record<string, MessageKey> = {
  duplicate_code: "mapEditor.error.duplicateCode",
  invalid_code: "mapEditor.error.invalidCode",
  point_outside_geometry: "mapEditor.error.pointOutside",
  block_outside_quadrant: "mapEditor.error.pointOutside",
  move_outside_geometry: "mapEditor.error.pointOutside",
  invalid_geometry: "mapEditor.error.shape",
  evidence_required: "mapEditor.error.reason",
};

/** Plain-language reason of a failed write; field codes win over the generic status. */
export function failureKey(outcome: WriteOutcome<unknown> | null): MessageKey | null {
  if (outcome?.kind !== "failed") return null;
  const field = outcome.fieldCodes?.find((code) => code in FIELD_KEYS);
  return (field ? FIELD_KEYS[field] : undefined) ?? FIELD_KEYS[outcome.code] ?? outcome.key;
}

const idOf = (value: unknown): string | null =>
  typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"
    ? value.id
    : null;

/** One save for the whole draft: every item in a safe order, errors kept per item. */
export function useEditorSaves(scope: GeographyScope, data: EditorData, editor: MapEditor) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const write = useGeographyWrite<unknown>();
  const [errors, setErrors] = useState<Readonly<Record<string, MessageKey>>>({});
  const [decisions, setDecisions] = useState<Readonly<Record<string, OutsideDecision>>>({});
  const [reason, setReason] = useState("");
  const [isSaving, setSaving] = useState(false);

  const issues = useMemo(() => shapeIssues(data, editor.shapes), [data, editor.shapes]);
  const outside = useMemo(() => outsidePoints(data, editor.shapes), [data, editor.shapes]);
  const undecided = outside.filter((item) => !item.movedTo && !decisions[item.point.id]);
  const needsReason = outside.length > 0;
  const missingReason = needsReason && reason.trim().length === 0;
  const canSave =
    editor.pendingCount > 0 &&
    issues.size === 0 &&
    undecided.length === 0 &&
    !missingReason &&
    !isSaving;
  /** Why "Guardar cambios" is off, in plain words (undefined when it is on or nothing changed). */
  const blockedKey: MessageKey | undefined =
    editor.pendingCount === 0
      ? undefined
      : issues.size > 0
        ? "mapEditor.save.fix"
        : undecided.length > 0
          ? "mapEditor.save.decide"
          : missingReason
            ? "mapEditor.save.reason"
            : undefined;

  const send = async (step: PlanStep, ids: Map<string, string>, blocks: Map<string, string>) => {
    const parentOf = (ref: Ref, map: Map<string, string>) =>
      "id" in ref ? ref.id : map.get(ref.quadrantKey);
    switch (step.type) {
      case "quadrant":
        return write.execute((signal) =>
          scope.client.POST("/api/v1/quadrants/", {
            body: { code: step.code, center: step.center, geometry: step.polygon },
            signal,
          }),
        );
      case "block": {
        const quadrant = ids.get(step.quadrantKey);
        if (!quadrant) return null;
        return write.execute((signal) =>
          scope.client.POST("/api/v1/blocks/", {
            body: { quadrant, code: step.code, geometry: step.polygon },
            signal,
          }),
        );
      }
      case "version":
        return write.execute((signal) =>
          scope.client.POST("/api/v1/quadrants/{id}/versions/", {
            params: { path: { id: step.recordId } },
            body: {
              expected_revision: step.revision,
              geometry: step.polygon,
              point_resolutions: step.resolutions,
            },
            signal,
          }),
        );
      case "sampling": {
        const block = "id" in step.parent ? step.parent.id : blocks.get(step.parent.quadrantKey);
        if (!block) return null;
        return write.execute((signal) =>
          scope.client.POST("/api/v1/sampling-points/", {
            body: { block, code: step.code, location: step.location },
            signal,
          }),
        );
      }
      case "release": {
        const quadrant = parentOf(step.parent, ids);
        if (!quadrant) return null;
        return write.execute((signal) =>
          scope.client.POST("/api/v1/release-points/", {
            body: { quadrant, code: step.code, location: step.location },
            signal,
          }),
        );
      }
      case "move": {
        const body = { expected_revision: step.revision, location: step.location };
        return step.kind === "sampling"
          ? write.execute((signal) =>
              scope.client.POST("/api/v1/sampling-points/{id}/versions/", {
                params: { path: { id: step.recordId } },
                body,
                signal,
              }),
            )
          : write.execute((signal) =>
              scope.client.POST("/api/v1/release-points/{id}/move/", {
                params: { path: { id: step.recordId } },
                body,
                signal,
              }),
            );
      }
    }
  };

  const saveAll = async () => {
    if (!canSave) return;
    setSaving(true);
    setErrors({});
    const plan = buildPlan({ data, shapes: editor.shapes, decisions, reason: reason.trim() });
    const ids = new Map<string, string>();
    const blocks = new Map<string, string>();
    const done = new Set<string>();
    const failed: Record<string, MessageKey> = {};
    /** Quadrants whose points cannot be saved, with the reason to show on each point. */
    const lost = new Map<string, MessageKey>();
    for (const step of plan) {
      const parent = "parent" in step ? step.parent : undefined;
      const quadrantKey =
        step.type === "block"
          ? step.quadrantKey
          : parent && "quadrantKey" in parent
            ? parent.quadrantKey
            : null;
      const blockedBy = quadrantKey ? lost.get(quadrantKey) : undefined;
      if (blockedBy) {
        if (step.type !== "block") failed[step.key] = blockedBy;
        continue;
      }
      const outcome = await send(step, ids, blocks);
      if (outcome?.kind === "saved") {
        if (step.type === "quadrant") ids.set(step.key, idOf(outcome.value) ?? "");
        if (step.type === "block") blocks.set(step.quadrantKey, idOf(outcome.value) ?? "");
        if (step.type !== "block") done.add(step.key);
        if (step.type === "version") step.covers.forEach((key) => done.add(key));
        continue;
      }
      const reasonKey = failureKey(outcome) ?? "mapEditor.save.retry";
      if (step.type === "block") lost.set(step.quadrantKey, reasonKey);
      else {
        failed[step.key] = reasonKey;
        if (step.type === "quadrant") lost.set(step.key, "mapEditor.save.skipped");
      }
    }
    // The map reloads the saved records before the draft lets go of its copies: no flicker.
    await data.refresh();
    const savedNow = new Set([...done].filter((key) => !(key in failed)));
    editor.settle(savedNow);
    setErrors(failed);
    setSaving(false);
    const failures = Object.keys(failed).length;
    if (failures === 0) {
      setDecisions({});
      setReason("");
      showToast({ message: t("mapEditor.saved.all", { count: savedNow.size }), tone: "success" });
    } else
      showToast({
        message: t("mapEditor.save.partial", { saved: savedNow.size, failed: failures }),
        tone: "warning",
      });
  };

  return {
    isBusy: isSaving || write.isBusy,
    canSave,
    blockedKey,
    issues,
    outside,
    errors,
    decisions,
    reason,
    setReason,
    decide: (point: string, decision: OutsideDecision) => {
      setDecisions((current) => ({ ...current, [point]: decision }));
    },
    saveAll,
  };
}

export type EditorSaves = ReturnType<typeof useEditorSaves>;
