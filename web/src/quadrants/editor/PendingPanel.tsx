/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { Save, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { Tooltip } from "../../ui/Tooltip";
import type { EditorData } from "./use-editor-data";
import type { MapEditor } from "./use-map-editor";
import type { EditorSaves } from "./use-editor-saves";
import { KEY_SAVE } from "./editor-shortcuts";
import { OutsideDecisions } from "./OutsideDecisions";
import { PendingRow } from "./PendingRow";

interface Props {
  data: EditorData;
  editor: MapEditor;
  saves: EditorSaves;
}

/** Everything unsaved in one list, with one button that saves it all. */
export function PendingPanel({ data, editor, saves }: Props) {
  const { t } = useTranslation();
  const count = editor.pendingCount;
  return (
    <section aria-label={t("mapEditor.pending.title")} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-sm font-semibold text-ink">{t("mapEditor.pending.title")}</h2>
        <span
          className="inline-flex min-w-6 items-center justify-center rounded-full bg-tint px-2 text-xs leading-6 font-bold text-action-strong tabular-nums"
          aria-label={t("mapEditor.pending.count", { count })}
        >
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="m-0 text-sm text-ink-2">{t("mapEditor.pending.empty")}</p>
      ) : (
        <>
          <ul className="m-0 flex max-h-[44vh] list-none flex-col gap-2.5 overflow-y-auto p-0 pr-0.5">
            {editor.pending.map((shape) => (
              <PendingRow
                key={shape.key}
                shape={shape}
                data={data}
                editor={editor}
                saves={saves}
                isSelected={shape.key === editor.selectedKey}
              />
            ))}
          </ul>
          <OutsideDecisions saves={saves} />
          {saves.blockedKey && (
            <p className="m-0 text-xs text-ink-2" role="status">
              {t(saves.blockedKey)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Tooltip content={`${t("mapEditor.action.saveChanges")} (${KEY_SAVE})`}>
              <Button
                leadingIcon={<Save aria-hidden="true" />}
                loading={saves.isBusy}
                disabled={!saves.canSave}
                aria-keyshortcuts={KEY_SAVE}
                onClick={() => void saves.saveAll()}
              >
                {t("mapEditor.action.saveChanges")}
              </Button>
            </Tooltip>
            <Button
              variant="ghost"
              leadingIcon={<Trash2 aria-hidden="true" />}
              disabled={saves.isBusy}
              onClick={editor.discardAll}
            >
              {t("mapEditor.action.discardAll")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
