import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { useFormatCalendarDate } from "../format/use-formatters";
import { useCan } from "../session/use-can";
import { buttonVariants } from "../ui/button-variants";
import { Card } from "../ui/Card";
import { CardSkeleton } from "../ui/CardSkeleton";
import { EmptyState } from "../ui/EmptyState";
import { InfoHint } from "../ui/InfoHint";
import { InlineNotice } from "../ui/InlineNotice";
import { StatusPill } from "../ui/StatusPill";
import { ACTION_ICON, ACTION_ORDER, RISK_TONE } from "./action-meta";
import { groupByQuadrant } from "./group-tasks";
import type { TaskGroup } from "./group-tasks";
import { ScheduleLegend } from "./ScheduleLegend";
import { useQuadrantCodes } from "./use-directories";
import type { Plan } from "./use-plan";

type Task = Schemas["Task"];

function Reason({ group }: { group: TaskGroup }) {
  const { t } = useTranslation();
  if (group.risk === "none") return <>{t("scheduling.day.noRisk")}</>;
  const origin =
    group.source === "official_import"
      ? t("scheduling.risk.sourceOfficial")
      : group.source === "company_rule"
        ? t("scheduling.risk.sourceCompany")
        : null;
  return (
    <>
      {(["high", "medium", "low"] as const)
        .filter((risk) => group.byRisk[risk] > 0)
        .map((risk) => `${t(`scheduling.risk.${risk}`)}: ${String(group.byRisk[risk])}`)
        .join(" · ")}
      {origin && ` · ${t("scheduling.day.source", { source: origin })}`}
      {group.protocol && ` · ${t("scheduling.day.protocol", { protocol: group.protocol })}`}
    </>
  );
}

/** The day of one courier, quadrant by quadrant, most urgent first, with the reason visible. */
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
  const can = useCan();
  const formatDay = useFormatCalendarDate();
  const codeOf = useQuadrantCodes();
  const groups = groupByQuadrant(tasks, codeOf);
  const hasNoRisk = groups.length > 0 && groups.every((group) => group.risk === "none");
  if (plan.courier === undefined) {
    return (
      <Card title={t("scheduling.day.title", { name: "…", day: formatDay(plan.day) })}>
        <EmptyState kind="noData" message={t("scheduling.day.pick")} />
      </Card>
    );
  }
  if (plan.isTasksLoading) return <CardSkeleton />;
  return (
    <Card
      title={
        <span className="inline-flex items-center gap-1">
          {t("scheduling.day.title", { name: courierName, day: formatDay(plan.day) })}
          <InfoHint text={t("scheduling.glossary.risk")} />
        </span>
      }
    >
      <p className="mt-0 mb-3 text-[13px] text-ink-2">{t("scheduling.day.subtitle")}</p>
      {hasNoRisk && (
        <div className="mb-3">
          <InlineNotice
            tone="info"
            action={
              can("risk_import.apply") && (
                <Link to="/scheduling/risk/import" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  {t("scheduling.step.risk.load")}
                </Link>
              )
            }
          >
            <p>{t("scheduling.day.noRiskHelp")}</p>
          </InlineNotice>
        </div>
      )}
      {groups.length === 0 ? (
        <EmptyState kind="noData" message={t("scheduling.day.empty")} />
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {groups.map((group) => (
            <li
              key={group.quadrant}
              className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-t border-line py-3 first:border-t-0 first:pt-0"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={RISK_TONE[group.risk]}>
                    {t(`scheduling.risk.${group.risk}`)}
                  </StatusPill>
                  <span className="font-semibold text-ink">{codeOf(group.quadrant)}</span>
                  <span className="text-xs text-ink-2 tabular-nums">
                    {t("scheduling.day.points", { count: group.total })}
                  </span>
                </span>
                <span className="text-xs text-ink-2">
                  <Reason group={group} />
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink tabular-nums">
                {ACTION_ORDER.filter((action) => (group.actions[action] ?? 0) > 0).map((action) => {
                  const Icon = ACTION_ICON[action];
                  return (
                    <span key={action} className="inline-flex items-center gap-1.5">
                      <Icon aria-hidden="true" className="size-4 text-action-strong" />
                      {t(`scheduling.action.${action}`, { count: group.actions[action] ?? 0 })}
                    </span>
                  );
                })}
                {group.done > 0 && (
                  <span className="text-xs text-success-fg">
                    {t("scheduling.day.done", { count: group.done })}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <ScheduleLegend />
    </Card>
  );
}
