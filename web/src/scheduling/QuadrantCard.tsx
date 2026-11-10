import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { SelectMenu } from "../ui/SelectMenu";
import { useFormatNumber } from "../format/use-formatters";

type Row = Schemas["Assignment"];

/** One quadrant with its daily load against the target and a keyboard-friendly "Move to". */
export function QuadrantCard({
  row,
  options,
  canMove,
  isBusy,
  onMove,
}: {
  row: Row;
  options: readonly { value: string; label: string }[];
  canMove: boolean;
  isBusy: boolean;
  onMove: (courierId: string | null) => void;
}) {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  const isOver = row.target > 0 && row.load > row.target;
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-semibold text-ink">{row.code}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-[13px] font-medium tabular-nums text-ink-2",
            isOver && "text-warning-fg",
          )}
        >
          {isOver && <TriangleAlert aria-hidden="true" className="size-3.5" />}
          {t("scheduling.assign.load", {
            load: formatNumber(row.load),
            target: formatNumber(row.target),
          })}
        </span>
      </div>
      <Progress
        value={row.target > 0 ? Math.min(100, (row.load / row.target) * 100) : 0}
        aria-label={t("scheduling.assign.loadLabel", { code: row.code })}
        className={cn(
          "h-2 bg-tint [&>[data-slot=progress-indicator]]:bg-action",
          isOver && "[&>[data-slot=progress-indicator]]:bg-warning-fg",
        )}
      />
      {row.blockers.length > 0 && (
        <p className="m-0 text-xs text-warning-fg">{t("scheduling.assign.blocked")}</p>
      )}
      <SelectMenu
        id={`move-${row.quadrant}`}
        value=""
        ariaLabel={t("scheduling.assign.moveAria", { code: row.code })}
        placeholder={t("scheduling.assign.move")}
        disabled={!canMove || isBusy}
        options={options}
        onValueChange={(value) => {
          if (value !== "") onMove(value === "none" ? null : value);
        }}
      />
    </li>
  );
}
