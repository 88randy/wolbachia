import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { LoadMeter } from "./LoadMeter";
import { QuadrantCard } from "./QuadrantCard";
import type { AssignmentBoard, BoardColumn } from "./use-assignment-board";

/** One courier: name, load against target, and the quadrants they cover. A drop target. */
export function CourierColumn({ column, board }: { column: BoardColumn; board: AssignmentBoard }) {
  const { t } = useTranslation();
  const [isOver, setIsOver] = useState(false);
  const headingId = `col-${column.courier ?? "none"}`;
  const options = board.options.filter((option) => option.value !== column.courier);
  const canDrop = board.canMove && board.dragging !== null;
  return (
    <section
      aria-labelledby={headingId}
      onDragOver={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => {
        setIsOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        const row = board.rows.find((item) => item.quadrant === board.dragging);
        board.endDrag();
        if (row) board.moveTo(row, column.courier);
      }}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-2xl border border-transparent bg-surface-muted p-3",
        column.courier === null && "border-warning-fg/40 bg-warning-bg/40",
        isOver && "border-action ring-2 ring-action",
      )}
    >
      <header className="flex flex-col gap-3 px-1">
        <div className="flex flex-col gap-0.5">
          <h2 id={headingId} className="m-0 text-[15px] font-semibold text-ink">
            {column.courier === null ? (
              <span className="inline-flex items-center gap-1.5">
                <TriangleAlert aria-hidden="true" className="size-4 text-warning-fg" />
                {t("scheduling.assign.unassignedTitle")}
              </span>
            ) : (
              column.name
            )}
          </h2>
          <span className="text-xs text-ink-2 tabular-nums">
            {t("scheduling.assign.columnSummary", { count: column.rows.length })}
          </span>
        </div>
        {column.courier === null ? (
          <p className="m-0 text-xs text-warning-fg">{t("scheduling.assign.unassignedHelp")}</p>
        ) : (
          <LoadMeter
            name={column.name}
            peak={column.peak}
            target={board.target}
            weekPending={column.weekPending}
          />
        )}
      </header>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {column.rows.map((row) => (
          <QuadrantCard
            key={row.quadrant}
            row={row}
            canMove={board.canMove}
            isSaving={board.savingId === row.quadrant}
            isDragging={board.dragging === row.quadrant}
            options={options}
            onDragStart={() => {
              board.startDrag(row.quadrant);
            }}
            onDragEnd={board.endDrag}
            onMove={(courier) => {
              board.moveTo(row, courier);
            }}
          />
        ))}
        {column.rows.length === 0 && (
          <li className="rounded-xl border border-dashed border-line-strong p-4 text-center text-[13px] text-ink-2">
            {isOver ? t("scheduling.assign.columnDrop") : t("scheduling.assign.columnEmpty")}
          </li>
        )}
      </ul>
    </section>
  );
}
