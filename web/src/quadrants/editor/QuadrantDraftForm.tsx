/* eslint-disable max-lines-per-function -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Save, Undo2, X } from "lucide-react";
import { TextField } from "../../forms/TextField";
import { Button } from "../../ui/Button";
import { SelectMenu } from "../../ui/SelectMenu";
import { InlineNotice } from "../../ui/InlineNotice";
import type { EditorData } from "./use-editor-data";
import type { MapEditor } from "./use-map-editor";
import type { EditorSaves } from "./use-editor-saves";
import { nextCode, pointsInside } from "./editor-model";
import { DraftFacts } from "./DraftFacts";
import { polygonAreaKm2 } from "./geo-math";

interface Props {
  data: EditorData;
  editor: MapEditor;
  saves: EditorSaves;
}

/** Step 1: click the corners. Step 2: name it, choose its center and save. */
export function QuadrantDraftForm({ data, editor, saves }: Props) {
  const { t } = useTranslation();
  const [code, setCode] = useState(() =>
    nextCode(
      data.quadrants.map((item) => item.code),
      "C-",
    ),
  );
  const [center, setCenter] = useState(data.centers[0]?.id ?? "");
  const draft = editor.quadrantDraft;
  if (!draft)
    return (
      <div className="flex flex-col gap-3">
        <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-sm text-ink-2">
          <li>{t("mapEditor.quadrant.step1")}</li>
          <li>{t("mapEditor.quadrant.step2")}</li>
        </ol>
        <p className="m-0 text-sm text-ink" role="status">
          {t("mapEditor.quadrant.corners", { count: editor.vertexCount })}
        </p>
        <Button
          variant="secondary"
          leadingIcon={<Undo2 aria-hidden="true" />}
          onClick={editor.undo}
          disabled={editor.vertexCount === 0}
        >
          {t("mapEditor.action.undo")}
        </Button>
      </div>
    );
  const isReady = Boolean(code.trim()) && Boolean(center);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (isReady) void saves.saveQuadrant(code, center);
      }}
    >
      <InlineNotice tone="success">{t("mapEditor.quadrant.closed")}</InlineNotice>
      <TextField
        id="map-editor-quadrant-code"
        label={t("mapEditor.field.name")}
        value={code}
        maxLength={50}
        onChange={(event) => {
          setCode(event.target.value);
        }}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="map-editor-center" className="text-[13px] font-semibold text-ink">
          {t("mapEditor.field.center")}
        </label>
        <SelectMenu
          id="map-editor-center"
          value={center}
          placeholder={t("mapEditor.field.centerPlaceholder")}
          options={data.centers.map((item) => ({ value: item.id, label: item.name }))}
          onValueChange={setCenter}
        />
      </div>
      <DraftFacts
        areaKm2={polygonAreaKm2(draft.polygon)}
        points={pointsInside(draft.polygon, data.points)}
      />
      <p className="m-0 text-xs text-ink-2">{t("mapEditor.quadrant.adjust")}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          leadingIcon={<Save aria-hidden="true" />}
          loading={saves.isBusy}
          disabled={!isReady}
        >
          {t("mapEditor.action.saveQuadrant")}
        </Button>
        <Button
          variant="ghost"
          leadingIcon={<X aria-hidden="true" />}
          onClick={() => {
            editor.setTool("quadrant");
          }}
        >
          {t("mapEditor.action.redraw")}
        </Button>
      </div>
    </form>
  );
}
