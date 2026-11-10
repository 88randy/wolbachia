import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { StatusPill } from "../ui/StatusPill";
import { CardSkeleton } from "../ui/CardSkeleton";
import { useFormatCalendarDate } from "../format/use-formatters";
import { useQuadrantCodes } from "./use-directories";
import { groupByQuadrant } from "./group-tasks";
import type { Plan } from "./use-plan";

type Task = Schemas["Task"];

const RISK_TONE = { high: "critical", medium: "warning", low: "neutral", none: "neutral" } as const;
const ACTION_KEY = {
  check: "scheduling.action.check",
  place: "scheduling.action.place",
  release: "scheduling.action.release",
} as const;

/** The day of one courier, quadrant by quadrant, highest risk first. */
export function ScheduleDayList({
  plan,
  tasks,
  courierName,
}: {
  plan: Plan;
  tasks: readonly Task[];
  courierName: string;
}) {
  const { t } = useTranslation();
  const formatDay = useFormatCalendarDate();
  const codeOf = useQuadrantCodes();
  const groups = groupByQuadrant(tasks);
  const title = t("scheduling.day.title", { name: courierName, day: formatDay(plan.day) });
  if (plan.isTasksLoading) return <CardSkeleton />;
  return (
    <Card title={title}>
      {groups.length === 0 ? (
        <EmptyState kind="noData" message={t("scheduling.day.empty")} />
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {groups.map((group) => (
            <li
              key={group.quadrant}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3 first:border-t-0 first:pt-0"
            >
              <span className="flex min-w-0 items-center gap-3">
                <StatusPill tone={RISK_TONE[group.risk]}>
                  {t(`scheduling.risk.${group.risk}`)}
                </StatusPill>
                <span className="font-semibold text-ink">{codeOf(group.quadrant)}</span>
              </span>
              <span className="text-sm text-ink-2 tabular-nums">
                {(Object.keys(group.actions) as (keyof typeof ACTION_KEY)[])
                  .map((action) => t(ACTION_KEY[action], { count: group.actions[action] ?? 0 }))
                  .join(" · ")}
                {group.done > 0 && ` · ${t("scheduling.day.done", { count: group.done })}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
