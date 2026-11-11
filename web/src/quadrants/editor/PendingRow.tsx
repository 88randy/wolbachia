/* eslint-disable max-lines-per-function, complexity -- fast mode (demo 2026-11-20): Terra Draw editor, split after the demo. */
import { CircleAlert, Crosshair, Flag, LayoutGrid, MapPin, PenLine, Undo2, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { cn } from "@/lib/utils";
import { TextField } from "../../forms/TextField";
import { SelectMenu } from "../../ui/SelectMenu";
import { Tooltip } from "../../ui/Tooltip";
import type { Polygon } from "../geography/geometry";
import type { EditorData } from "./use-editor-data";
import type { MapEditor } from "./use-map-editor";
import type { EditorSaves } from "./use-editor-saves";
import type { DraftShape, ShapeKind } from "./editor-draft";
import { holdingBlock, holdingQuadrant, vertices } from "./editor-places";
import { polygonAreaKm2 } from "./geo-math";

const ICONS: Record<ShapeKind, LucideIcon> = {
  quadrant: PenLine,
  block: LayoutGrid,
  sampling: MapPin,
  release: Flag,
};
const EDITED_TITLES: Record<ShapeKind, MessageKey> = {
  quadrant: "mapEditor.pending.editedQuadrant",
  block: "mapEditor.pending.editedBlock",
  sampling: "mapEditor.pending.movedPoint",
  release: "mapEditor.pending.movedPoint",
};
const NEW_TITLES: Record<ShapeKind, MessageKey> = {
  quadrant: "mapEditor.pending.newQuadrant",
  block: "mapEditor.pending.newBlock",
  sampling: "mapEditor.pending.newSampling",
  release: "mapEditor.pending.newRelease",
};

interface Props {
  shape: DraftShape;
  data: EditorData;
  editor: MapEditor;
  saves: EditorSaves;
  isSelected: boolean;
}

function IconAction({
  label,
  icon: Icon,
  onClick,
  isDisabled,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  isDisabled: boolean;
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        disabled={isDisabled}
        onClick={onClick}
        className="inline-flex size-8 items-center justify-center rounded-lg text-ink-2 hover:bg-tint hover:text-action-strong disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Icon aria-hidden="true" className="size-4" />
      </button>
    </Tooltip>
  );
}

/** One pending item: what it is, where it is, its name, and why it cannot be saved yet. */
export function PendingRow({ shape, data, editor, saves, isSelected }: Props) {
  const { t, i18n } = useTranslation();
  const Icon = ICONS[shape.kind];
  const isNew = !shape.saved;
  const problem = saves.issues.get(shape.key) ?? saves.errors[shape.key];
  const place = shape.geometry.type === "Point" ? shape.geometry.coordinates : null;
  const shapes = editor.shapes;
  const block = place ? holdingBlock(data, shapes, place) : undefined;
  const quadrant =
    place || shape.kind === "block"
      ? holdingQuadrant(data, shapes, place ? [place] : vertices(shape.geometry as Polygon))
      : undefined;
  const title = isNew
    ? t(NEW_TITLES[shape.kind])
    : t(EDITED_TITLES[shape.kind], { code: shape.saved?.code ?? "" });
  const area =
    shape.geometry.type === "Polygon"
      ? new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 }).format(
          polygonAreaKm2(shape.geometry),
        )
      : null;
  return (
    <li
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border bg-surface p-3",
        isSelected ? "border-action ring-2 ring-action/30" : "border-line",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="size-4 flex-none text-action" />
        <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink">{title}</span>
        <IconAction
          label={t("mapEditor.action.show")}
          icon={Crosshair}
          isDisabled={saves.isBusy}
          onClick={() => {
            editor.select(shape.key);
          }}
        />
        {isNew ? (
          <IconAction
            label={t("mapEditor.action.remove")}
            icon={X}
            isDisabled={saves.isBusy}
            onClick={() => {
              editor.removeShape(shape.key);
            }}
          />
        ) : (
          <IconAction
            label={t("mapEditor.action.revert")}
            icon={Undo2}
            isDisabled={saves.isBusy}
            onClick={() => {
              editor.revertShape(shape.key);
            }}
          />
        )}
      </div>
      {isNew && (
        <TextField
          id={`map-editor-name-${shape.key}`}
          label={t(
            shape.kind === "quadrant"
              ? "mapEditor.field.name"
              : shape.kind === "block"
                ? "mapEditor.field.blockName"
                : "mapEditor.field.pointName",
          )}
          value={shape.code}
          maxLength={50}
          disabled={saves.isBusy}
          onChange={(event) => {
            editor.updateShape(shape.key, { code: event.target.value });
          }}
        />
      )}
      {isNew && shape.kind === "quadrant" && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`map-editor-center-${shape.key}`}
            className="text-[13px] font-semibold text-ink"
          >
            {t("mapEditor.field.center")}
          </label>
          <SelectMenu
            id={`map-editor-center-${shape.key}`}
            value={shape.centerId}
            disabled={saves.isBusy}
            placeholder={t("mapEditor.field.centerPlaceholder")}
            options={data.centers.map((item) => ({ value: item.id, label: item.name }))}
            onValueChange={(value) => {
              editor.updateShape(shape.key, { centerId: value });
            }}
          />
        </div>
      )}
      {area !== null && (
        <p className="m-0 text-xs text-ink-2">{t("mapEditor.fact.areaValue", { area })}</p>
      )}
      {isNew && shape.kind === "sampling" && !problem && (
        <p className="m-0 text-xs text-ink-2">
          {block
            ? t("mapEditor.point.inBlock", {
                block: block.code,
                quadrant: quadrant?.code ?? "",
              })
            : t("mapEditor.pending.autoBlock")}
        </p>
      )}
      {isNew && (shape.kind === "release" || shape.kind === "block") && !problem && quadrant && (
        <p className="m-0 text-xs text-ink-2">
          {t("mapEditor.point.inQuadrant", { quadrant: quadrant.code })}
        </p>
      )}
      {problem && (
        <p
          role="alert"
          className="m-0 flex items-start gap-1.5 text-xs font-semibold text-critical-fg"
        >
          <CircleAlert aria-hidden="true" className="mt-px size-3.5 flex-none" />
          {t(problem)}
        </p>
      )}
    </li>
  );
}
