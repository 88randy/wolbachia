/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { useToast } from "../../ui/toast-context";
import type { GeographyScope } from "../geography/use-w-15";
import { useGeographyWrite } from "../geography/use-geography-write";
import type { WriteOutcome } from "../geography/write-result";
import type { MapEditor } from "./use-map-editor";
import type { EditorData } from "./use-editor-data";
import { blockAt, quadrantAt } from "./editor-model";
import type { MovePlan, OutsideDecision } from "./move-plan";

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

export function useEditorSaves(scope: GeographyScope, data: EditorData, editor: MapEditor) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const write = useGeographyWrite<unknown>();
  const [failedKey, setFailedKey] = useState<MessageKey | null>(null);

  const finish = (outcome: WriteOutcome<unknown>, message: MessageKey) => {
    if (outcome.kind === "saved") {
      setFailedKey(null);
      showToast({ message: t(message), tone: "success" });
      editor.setTool("browse");
      return true;
    }
    setFailedKey(failureKey(outcome));
    return false;
  };

  const saveQuadrant = async (code: string, center: string) => {
    const draft = editor.quadrantDraft;
    if (!draft) return;
    const outcome = await write.execute((signal) =>
      scope.client.POST("/api/v1/quadrants/", {
        body: { code: code.trim(), center, geometry: draft.polygon },
        signal,
      }),
    );
    finish(outcome, "mapEditor.saved.quadrant");
  };

  const savePoint = async (code: string) => {
    const draft = editor.pointDraft;
    if (!draft) return;
    if (draft.kind === "sampling") {
      const block = blockAt(data.blocks, draft.location);
      if (!block) return;
      const outcome = await write.execute((signal) =>
        scope.client.POST("/api/v1/sampling-points/", {
          body: { block: block.id, code: code.trim(), location: draft.location },
          signal,
        }),
      );
      finish(outcome, "mapEditor.saved.sampling");
      return;
    }
    const quadrant = quadrantAt(data.quadrants, draft.location);
    if (!quadrant) return;
    const outcome = await write.execute((signal) =>
      scope.client.POST("/api/v1/release-points/", {
        body: { quadrant: quadrant.id, code: code.trim(), location: draft.location },
        signal,
      }),
    );
    finish(outcome, "mapEditor.saved.release");
  };

  const saveMoves = async (
    plan: MovePlan,
    decisions: Readonly<Record<string, OutsideDecision>>,
    reason: string,
  ) => {
    const polygon = editor.editPolygon;
    if (plan.polygonChanged && plan.quadrant && polygon) {
      const resolutions: Schemas["PointResolutionRequest"][] = plan.outside.map((item) =>
        item.movedTo
          ? { point: item.point.id, decision: "move", evidence: reason, location: item.movedTo }
          : {
              point: item.point.id,
              decision: decisions[item.point.id] || "keep",
              evidence: reason,
            },
      );
      const quadrant = plan.quadrant;
      const outcome = await write.execute((signal) =>
        scope.client.POST("/api/v1/quadrants/{id}/versions/", {
          params: { path: { id: quadrant.recordId } },
          body: {
            expected_revision: quadrant.revision,
            geometry: polygon,
            point_resolutions: resolutions,
          },
          signal,
        }),
      );
      if (outcome.kind !== "saved") {
        setFailedKey(failureKey(outcome));
        return;
      }
    }
    for (const move of plan.moves) {
      const body = { expected_revision: move.revision, location: move.location };
      const outcome = await write.execute((signal) =>
        move.kind === "sampling"
          ? scope.client.POST("/api/v1/sampling-points/{id}/versions/", {
              params: { path: { id: move.recordId } },
              body,
              signal,
            })
          : scope.client.POST("/api/v1/release-points/{id}/move/", {
              params: { path: { id: move.recordId } },
              body,
              signal,
            }),
      );
      if (outcome.kind !== "saved") {
        setFailedKey(failureKey(outcome));
        return;
      }
    }
    finish({ kind: "saved", value: null }, "mapEditor.saved.changes");
  };

  return {
    isBusy: write.isBusy,
    failedKey,
    clearFailure: () => {
      setFailedKey(null);
    },
    saveQuadrant,
    savePoint,
    saveMoves,
  };
}

export type EditorSaves = ReturnType<typeof useEditorSaves>;
