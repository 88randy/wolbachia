import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { StatusPill } from "../../ui/StatusPill";
import type { Tone } from "../../ui/tone";

/** Days the law gives to answer an ARCO request (mirrors the backend default). */
const LEGAL_DAYS = 20;
const WARNING_DAYS = 7;
const CRITICAL_DAYS = 3;

const BAR_TONES: Readonly<Record<string, string>> = {
  success: "bg-success-fg",
  warning: "bg-warning-fg",
  critical: "bg-critical-fg",
};

function toneOf(days: number): Tone {
  if (days <= CRITICAL_DAYS) return "critical";
  return days <= WARNING_DAYS ? "warning" : "success";
}

/** Remaining legal time: a bar that changes color, always with the number of days in words. */
export function ArcoDeadline({ remainingDays }: { remainingDays: number | null | undefined }) {
  const { t } = useTranslation();
  if (remainingDays === null || remainingDays === undefined)
    return <StatusPill tone="neutral">{t("regulatory.arco.closed")}</StatusPill>;
  const tone = toneOf(remainingDays);
  const used = Math.min(100, Math.max(4, ((LEGAL_DAYS - remainingDays) / LEGAL_DAYS) * 100));
  const text =
    remainingDays < 0
      ? t("regulatory.arco.overdue", { count: -remainingDays })
      : remainingDays === 0
        ? t("regulatory.arco.dueToday")
        : t("regulatory.arco.daysLeft", { count: remainingDays });
  return (
    <span className="flex min-w-36 flex-col items-start gap-1.5">
      <StatusPill tone={tone}>{text}</StatusPill>
      <span aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-line">
        <span
          className={cn("block h-full rounded-full", BAR_TONES[tone] ?? "bg-ink-3")}
          style={{ width: `${String(used)}%` }}
        />
      </span>
    </span>
  );
}
