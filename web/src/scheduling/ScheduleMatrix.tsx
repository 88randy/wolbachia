import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { InfoHint } from "../ui/InfoHint";
import { useFormatNumber } from "../format/use-formatters";
import { useLanguage } from "../i18n/use-language";
import type { Plan } from "./use-plan";

const WEEKDAY: Record<string, string> = { "es-MX": "es-MX", en: "en-US" };

function dayLabel(iso: string, locale: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat(WEEKDAY[locale] ?? "es-MX", {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** Couriers as rows, the days of the week as columns. Each number opens that courier and day. */
export function ScheduleMatrix({
  plan,
  nameOf,
  emptyAction,
}: {
  plan: Plan;
  nameOf: (id: string | null) => string;
  /** What to do when nothing is scheduled yet (a button, or nothing when it is not allowed). */
  emptyAction?: ReactNode;
}) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const formatNumber = useFormatNumber();
  const couriers = [...plan.loads.keys()].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  return (
    <Card
      title={
        <span className="inline-flex items-center gap-1">
          {t("scheduling.plan.matrixTitle")}
          <InfoHint text={t("scheduling.plan.matrixHint", { target: formatNumber(plan.target) })} />
        </span>
      }
    >
      {couriers.length === 0 && plan.taskCount > 0 ? (
        <EmptyState kind="noData" message={t("scheduling.plan.allDone")} />
      ) : couriers.length === 0 ? (
        <EmptyState
          kind="noData"
          message={`${t("scheduling.plan.noTasks")} ${t(emptyAction ? "scheduling.plan.noTasksHelp" : "scheduling.plan.noTasksReadOnly")}`}
          action={emptyAction}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t("scheduling.plan.matrixTitle")}</caption>
            <thead>
              <tr>
                <th scope="col" className="py-2 pr-4 text-left text-xs font-semibold text-ink-2">
                  {t("scheduling.plan.courier")}
                </th>
                {plan.days.map((date) => (
                  <th
                    key={date}
                    scope="col"
                    className={cn(
                      "px-3 py-2 text-right text-xs font-semibold text-ink-2 capitalize",
                      date === plan.today && "text-action",
                    )}
                  >
                    {dayLabel(date, language)}
                    {date === plan.today && (
                      <span className="block text-[11px] font-semibold normal-case">
                        {t("scheduling.plan.today")}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {couriers.map((id) => (
                <tr key={id} className="border-t border-line">
                  <th scope="row" className="py-2 pr-4 text-left font-semibold text-ink">
                    {nameOf(id)}
                  </th>
                  {plan.days.map((date) => {
                    const load = plan.loads.get(id)?.get(date) ?? 0;
                    const isSelected = id === plan.courier && date === plan.day;
                    const isOver = plan.target > 0 && load > plan.target;
                    return (
                      <td key={date} className="px-1 py-1 text-right tabular-nums">
                        {load === 0 ? (
                          <span
                            className="px-2 text-ink-3"
                            aria-label={t("scheduling.plan.noWork")}
                          >
                            —
                          </span>
                        ) : (
                          <Link
                            to="."
                            search={(previous) => ({ ...previous, day: date, courier: id })}
                            aria-current={isSelected ? "true" : undefined}
                            aria-label={t("scheduling.plan.openDay", {
                              name: nameOf(id),
                              day: dayLabel(date, language),
                              count: load,
                            })}
                            className={cn(
                              "inline-flex min-h-8 min-w-10 items-center justify-end gap-1 rounded-lg px-2 font-medium text-ink no-underline hover:bg-tint",
                              isSelected && "bg-action text-on-action hover:bg-action-strong",
                              isOver && !isSelected && "bg-warning-bg text-warning-fg",
                            )}
                          >
                            {isOver && <TriangleAlert aria-hidden="true" className="size-3.5" />}
                            {formatNumber(load)}
                          </Link>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
