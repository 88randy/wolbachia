/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import { SelectMenu } from "../../ui/SelectMenu";
import type { EditorSaves } from "./use-editor-saves";
import type { OutsideDecision } from "./editor-plan";

const REASON_MAX = 1000;

/** Points left outside a reshaped quadrant: one decision each, and one reason for the change. */
export function OutsideDecisions({ saves }: { saves: EditorSaves }) {
  const { t } = useTranslation();
  if (saves.outside.length === 0) return null;
  const options = [
    { value: "keep", label: t("mapEditor.move.keep") },
    { value: "remove", label: t("mapEditor.move.remove") },
  ];
  return (
    <div className="flex flex-col gap-3">
      <InlineNotice tone="critical">
        {t("mapEditor.move.outside", { count: saves.outside.length })}
      </InlineNotice>
      {saves.outside.map(({ point, movedTo }) => (
        <div
          key={point.id}
          className="flex flex-col gap-1.5 rounded-xl border border-line px-3 py-2"
        >
          <span className="text-sm font-semibold text-ink">{point.code}</span>
          {movedTo ? (
            <span className="text-xs text-success-fg">{t("mapEditor.move.movedInside")}</span>
          ) : (
            <SelectMenu
              id={`map-editor-decision-${point.id}`}
              ariaLabel={t("mapEditor.move.decision", { point: point.code })}
              value={saves.decisions[point.id] ?? ""}
              placeholder={t("mapEditor.move.choose")}
              options={options}
              onValueChange={(value) => {
                saves.decide(point.id, value as OutsideDecision);
              }}
            />
          )}
        </div>
      ))}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="map-editor-reason" className="text-[13px] font-semibold text-ink">
          {t("mapEditor.move.reason")}
        </label>
        <textarea
          id="map-editor-reason"
          value={saves.reason}
          maxLength={REASON_MAX}
          rows={3}
          onChange={(event) => {
            saves.setReason(event.target.value);
          }}
          className="rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13px] text-ink"
        />
      </div>
    </div>
  );
}
