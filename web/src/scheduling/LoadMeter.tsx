import { CircleCheck, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useFormatNumber } from "../format/use-formatters";

const NEAR = 0.85;

/** Load against target: a bar plus words and an icon, never color alone. */
export function LoadMeter({
  name,
  peak,
  target,
  weekPending,
}: {
  name: string;
  /** Pending points of the busiest day. */
  peak: number;
  target: number;
  weekPending: number;
}) {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  const ratio = target > 0 ? peak / target : 0;
  const isOver = ratio > 1;
  const isNear = !isOver && ratio >= NEAR;
  const Icon = isOver || isNear ? TriangleAlert : CircleCheck;
  const verdict = isOver
    ? "scheduling.assign.overTarget"
    : isNear
      ? "scheduling.assign.nearTarget"
      : "scheduling.assign.okTarget";
  return (
    <div className="flex flex-col gap-1.5">
      <Progress
        value={Math.min(100, ratio * 100)}
        aria-label={t("scheduling.assign.loadLabel", { name })}
        className={cn(
          "h-2.5 bg-tint [&>[data-slot=progress-indicator]]:bg-action",
          (isOver || isNear) && "[&>[data-slot=progress-indicator]]:bg-warning-fg",
        )}
      />
      <p className="m-0 text-[13px] leading-5 font-semibold text-ink tabular-nums">
        {t("scheduling.assign.loadPeak", { load: formatNumber(peak), target: formatNumber(target) })}
      </p>
      <p
        className={cn(
          "m-0 flex items-center gap-1.5 text-xs leading-4 font-medium",
          isOver || isNear ? "text-warning-fg" : "text-success-fg",
        )}
      >
        <Icon aria-hidden="true" className="size-3.5" />
        {t(verdict)}
      </p>
      <p className="m-0 text-xs text-ink-2 tabular-nums">
        {t("scheduling.assign.loadWeek", { count: formatNumber(weekPending) })}
      </p>
    </div>
  );
}
