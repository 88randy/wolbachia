import { GripVertical, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { cn } from "@/lib/utils";
import { EntityName } from "../lookups/EntityName";
import { SelectMenu } from "../ui/SelectMenu";

type Row = Schemas["Assignment"];

/** One quadrant: drag it to another courier, or use the keyboard-friendly "Mover a…". */
export function QuadrantCard({
  row,
  options,
  canMove,
  isSaving,
  isDragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  row: Row;
  options: readonly { value: string; label: string }[];
  canMove: boolean;
  isSaving: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (courierId: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <li
      draggable={canMove && !isSaving}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", row.quadrant);
        event.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 shadow-card",
        canMove && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-start gap-2">
        {canMove && (
          <GripVertical
            aria-hidden="true"
            className="mt-0.5 size-4 flex-none text-ink-3"
            data-testid="drag-handle"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] leading-6 font-semibold text-ink">{row.code}</span>
          <span className="text-xs text-ink-2">
            {t("scheduling.assign.center", { name: "" })}
            <EntityName kind="center" id={row.center_id} />
          </span>
        </div>
        {isSaving && (
          <span className="inline-flex items-center gap-1 text-xs text-ink-2" role="status">
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            {t("scheduling.assign.saving")}
          </span>
        )}
      </div>
      <SelectMenu
        id={`move-${row.quadrant}`}
        value=""
        ariaLabel={t("scheduling.assign.moveAria", { code: row.code })}
        placeholder={t("scheduling.assign.move")}
        disabled={!canMove || isSaving}
        options={[
          ...options,
          ...(row.courier === null
            ? []
            : [{ value: "none", label: t("scheduling.assign.unassign") }]),
        ]}
        onValueChange={(value) => {
          if (value !== "") onMove(value === "none" ? null : value);
        }}
      />
    </li>
  );
}
