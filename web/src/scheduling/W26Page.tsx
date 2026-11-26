import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DetailPage } from "../components/templates/DetailPage";
import { useFormatCalendarDate } from "../format/use-formatters";
import { useCan } from "../session/use-can";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/ErrorState";
import { InlineNotice } from "../ui/InlineNotice";
import { GenerateWeekButton } from "./GenerateWeekButton";
import { ReassignCard } from "./ReassignCard";
import { ScheduleDayList } from "./ScheduleDayList";
import { ScheduleMatrix } from "./ScheduleMatrix";
import { useCouriers } from "./use-directories";
import { usePlan } from "./use-plan";
import { addDays, weekNumberOf } from "./week-dates";

/** W26: who checks, places or releases what this week, and a safe way to reassign pending work. */
export function W26Page() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = useCan();
  const formatDay = useFormatCalendarDate();
  const plan = usePlan();
  const { nameOf, ids } = useCouriers([...plan.loads.keys()]);
  const goToWeek = (week: string) => {
    void navigate({ to: ".", search: { week } });
  };
  const selected = plan.courier;
  const pending = plan.tasks.filter((task) => !task.is_completed && task.courier === selected);
  const options = ids
    .filter((id) => id !== selected)
    .map((id) => ({ id, name: nameOf(id), load: plan.loads.get(id)?.get(plan.day) ?? 0 }));
  const canManage = can("schedule.manage");
  const past = plan.pastPending;
  const isPastShown =
    past.first !== undefined && plan.day === past.first.day && selected === past.first.courier;
  return (
    <DetailPage
      code={t("scheduling.plan.weekRange", {
        from: formatDay(plan.week),
        to: formatDay(addDays(plan.week, 6)),
      })}
      title={t("scheduling.plan.title", { week: weekNumberOf(plan.week) })}
      subtitle={t("scheduling.plan.description")}
      actions={
        <>
          <Button
            variant="tertiary"
            leadingIcon={<ChevronLeft aria-hidden="true" />}
            onClick={() => {
              goToWeek(addDays(plan.week, -7));
            }}
          >
            {t("scheduling.plan.previousWeek")}
          </Button>
          <Button
            variant="tertiary"
            onClick={() => {
              void navigate({ to: ".", search: {} });
            }}
          >
            {t("scheduling.plan.thisWeek")}
          </Button>
          <Button
            variant="tertiary"
            leadingIcon={<ChevronRight aria-hidden="true" />}
            onClick={() => {
              goToWeek(addDays(plan.week, 7));
            }}
          >
            {t("scheduling.plan.nextWeek")}
          </Button>
          {canManage && <GenerateWeekButton week={plan.week} />}
        </>
      }
      notices={
        past.count > 0 &&
        past.first && (
          <InlineNotice
            tone="warning"
            action={
              !isPastShown && (
                <Button
                  variant="secondary"
                  leadingIcon={<Send aria-hidden="true" />}
                  onClick={() => {
                    const first = past.first;
                    if (first === undefined) return;
                    void navigate({
                      to: ".",
                      search: (previous) => ({
                        ...previous,
                        day: first.day,
                        courier: first.courier,
                      }),
                    });
                  }}
                >
                  {t("scheduling.plan.pastAction")}
                </Button>
              )
            }
          >
            <p className="font-semibold">
              {t("scheduling.plan.pastBanner", { count: past.count })}
            </p>
          </InlineNotice>
        )
      }
    >
      {plan.isError ? (
        <ErrorState onRetry={plan.refetch} />
      ) : (
        <>
          <ScheduleMatrix
            plan={plan}
            nameOf={nameOf}
            emptyAction={
              canManage ? <GenerateWeekButton week={plan.week} variant="secondary" /> : undefined
            }
          />
          {plan.taskCount > 0 && (
            <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <ScheduleDayList
                plan={plan}
                tasks={plan.tasks}
                courierName={nameOf(selected ?? null)}
              />
              {pending.length > 0 && selected && (
                <ReassignCard
                  key={`${selected}:${plan.day}`}
                  pending={pending}
                  fromName={nameOf(selected)}
                  revision={plan.revision}
                  target={plan.target}
                  options={options}
                />
              )}
            </div>
          )}
        </>
      )}
    </DetailPage>
  );
}
