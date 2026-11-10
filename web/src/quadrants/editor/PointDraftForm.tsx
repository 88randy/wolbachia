/* eslint-disable max-lines-per-function, complexity -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Save } from "lucide-react";
import { TextField } from "../../forms/TextField";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
import type { EditorData } from "./use-editor-data";
import type { MapEditor } from "./use-map-editor";
import type { EditorSaves } from "./use-editor-saves";
import type { PointKind } from "./editor-model";
import { blockAt, nextCode, quadrantAt } from "./editor-model";
import { zoneContains } from "./geo-math";

interface Props {
  data: EditorData;
  editor: MapEditor;
  saves: EditorSaves;
  kind: PointKind;
}

function suggestedCode(data: EditorData, kind: PointKind, location: number[]) {
  const quadrant = quadrantAt(data.quadrants, location);
  if (kind === "release") {
    const codes = data.releasePoints
      .filter((item) => item.quadrant === quadrant?.id)
      .map((item) => item.code);
    return nextCode(codes, `${quadrant?.code ?? "PL"}-REL-P`);
  }
  const block = blockAt(data.blocks, location);
  const codes = data.points.filter((item) => item.block === block?.id).map((item) => item.code);
  return nextCode(codes, `${block?.code ?? "P"}-P`);
}

/** Click the map to place the point (click again to change it), then name it and save. */
export function PointDraftForm({ data, editor, saves, kind }: Props) {
  const { t } = useTranslation();
  const [edited, setCode] = useState<string | null>(null);
  const draft = editor.pointDraft;
  const hint = kind === "sampling" ? "mapEditor.point.samplingStep" : "mapEditor.point.releaseStep";
  if (!draft)
    return (
      <p className="m-0 text-sm text-ink-2" role="status">
        {t(hint)}
      </p>
    );
  const code = edited ?? suggestedCode(data, kind, draft.location);
  const quadrant = quadrantAt(data.quadrants, draft.location);
  const block = blockAt(data.blocks, draft.location);
  const placeOk = kind === "sampling" ? Boolean(block && quadrant) : Boolean(quadrant);
  const permits = data.permits.filter((item) => item.quadrant === quadrant?.id);
  const outsidePermit =
    kind === "release" &&
    data.canCheckPermits &&
    quadrant !== undefined &&
    !permits.some((item) => zoneContains(item.current_version?.geometry, draft.location));
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (placeOk && code.trim()) void saves.savePoint(code);
      }}
    >
      {placeOk ? (
        <InlineNotice tone="success">
          {block && kind === "sampling"
            ? t("mapEditor.point.inBlock", { block: block.code, quadrant: quadrant?.code ?? "" })
            : t("mapEditor.point.inQuadrant", { quadrant: quadrant?.code ?? "" })}
        </InlineNotice>
      ) : (
        <InlineNotice tone="critical">
          {t(kind === "sampling" ? "mapEditor.point.needBlock" : "mapEditor.point.needQuadrant")}
        </InlineNotice>
      )}
      {outsidePermit && (
        <InlineNotice tone="warning">{t("mapEditor.point.outsidePermit")}</InlineNotice>
      )}
      <TextField
        id="map-editor-point-code"
        label={t("mapEditor.field.pointName")}
        value={code}
        maxLength={50}
        onChange={(event) => {
          setCode(event.target.value);
        }}
      />
      <p className="m-0 text-xs text-ink-2">{t("mapEditor.point.again")}</p>
      <Button
        type="submit"
        leadingIcon={<Save aria-hidden="true" />}
        loading={saves.isBusy}
        disabled={!placeOk || !code.trim()}
      >
        {t(kind === "sampling" ? "mapEditor.action.saveSampling" : "mapEditor.action.saveRelease")}
      </Button>
    </form>
  );
}
