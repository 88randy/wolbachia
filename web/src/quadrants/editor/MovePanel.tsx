/* eslint-disable max-lines-per-function, complexity -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Save, X } from "lucide-react";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
import { SelectMenu } from "../../ui/SelectMenu";
import type { EditorData } from "./use-editor-data";
import type { MapEditor } from "./use-map-editor";
import type { EditorSaves } from "./use-editor-saves";
import { buildMovePlan } from "./move-plan";
import type { OutsideDecision } from "./move-plan";
import { DraftFacts } from "./DraftFacts";
import { polygonAreaKm2 } from "./geo-math";
import { pointsInside } from "./editor-model";

interface Props {
  data: EditorData;
  editor: MapEditor;
  saves: EditorSaves;
}

const REASON_MAX = 1000;

export function MovePanel({ data, editor, saves }: Props) {
  const { t } = useTranslation();
  const [decisions, setDecisions] = useState<Record<string, OutsideDecision>>({});
  const [reason, setReason] = useState("");
  const polygon = editor.editPolygon;
  if (!editor.quadrantId || !polygon)
    return (
      <p className="m-0 text-sm text-ink-2" role="status">
        {t("mapEditor.move.pick")}
      </p>
    );
  const plan = buildMovePlan(editor.targets, polygon, editor.moved, data.points);
  const pending = plan.outside.filter((item) => !item.movedTo && !decisions[item.point.id]);
  const needsReason = plan.outside.length > 0;
  const hasChanges = plan.polygonChanged || plan.moves.length > 0;
  const canSave = hasChanges && pending.length === 0 && (!needsReason || reason.trim().length > 0);
  const options = [
    { value: "keep", label: t("mapEditor.move.keep") },
    { value: "remove", label: t("mapEditor.move.remove") },
  ];
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) void saves.saveMoves(plan, decisions, reason.trim());
      }}
    >
      <p className="m-0 text-sm text-ink-2">{t("mapEditor.move.help")}</p>
      <DraftFacts
        areaKm2={polygonAreaKm2(polygon)}
        points={pointsInside(polygon, data.points)}
        blocks={data.blocks.filter((item) => item.quadrant === editor.quadrantId).length}
      />
      <p className="m-0 text-sm text-ink" role="status">
        {hasChanges
          ? t("mapEditor.move.changes", {
              count: plan.moves.length + (plan.polygonChanged ? 1 : 0),
            })
          : t("mapEditor.move.noChanges")}
      </p>
      {plan.outside.length > 0 && (
        <InlineNotice tone="critical">
          {t("mapEditor.move.outside", { count: plan.outside.length })}
        </InlineNotice>
      )}
      {plan.outside.map((item) => (
        <div
          key={item.point.id}
          className="flex flex-col gap-1.5 rounded-xl border border-line px-3 py-2"
        >
          <span className="text-sm font-semibold text-ink">{item.point.code}</span>
          {item.movedTo ? (
            <span className="text-xs text-success-fg">{t("mapEditor.move.movedInside")}</span>
          ) : (
            <SelectMenu
              id={`map-editor-decision-${item.point.id}`}
              ariaLabel={t("mapEditor.move.decision", { point: item.point.code })}
              value={decisions[item.point.id] ?? ""}
              placeholder={t("mapEditor.move.choose")}
              options={options}
              onValueChange={(value) => {
                setDecisions((current) => ({
                  ...current,
                  [item.point.id]: value as OutsideDecision,
                }));
              }}
            />
          )}
        </div>
      ))}
      {needsReason && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="map-editor-reason" className="text-[13px] font-semibold text-ink">
            {t("mapEditor.move.reason")}
          </label>
          <textarea
            id="map-editor-reason"
            value={reason}
            maxLength={REASON_MAX}
            rows={3}
            onChange={(event) => {
              setReason(event.target.value);
            }}
            className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13px] text-ink"
          />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          leadingIcon={<Save aria-hidden="true" />}
          loading={saves.isBusy}
          disabled={!canSave}
        >
          {t("mapEditor.action.saveChanges")}
        </Button>
        <Button
          variant="ghost"
          leadingIcon={<X aria-hidden="true" />}
          disabled={!hasChanges}
          onClick={() => {
            editor.selectQuadrant(editor.quadrantId);
          }}
        >
          {t("mapEditor.action.discard")}
        </Button>
      </div>
    </form>
  );
}
