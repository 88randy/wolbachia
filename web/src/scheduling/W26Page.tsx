import { useNavigate } from "@tanstack/react-router";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DetailPage } from "../components/templates/DetailPage";
import { useCan } from "../session/use-can";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/ErrorState";
import { ReassignCard } from "./ReassignCard";
import { ScheduleDayList } from "./ScheduleDayList";
import { ScheduleMatrix } from "./ScheduleMatrix";
import { useCouriers } from "./use-directories";
import { usePlan } from "./use-plan";
import { useGenerateWeek } from "./use-scheduling-writes";
import { addDays, weekNumberOf } from "./week-dates";

/** W26: who checks, places or removes what this week, and a safe way to reassign pending work. */
export function W26Page() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = useCan();
  const plan = usePlan();
  const generate = useGenerateWeek();
  const { nameOf, ids } = useCouriers([...plan.loads.keys()]);
  const goToWeek = (week: string) => {
    void navigate({ to: ".", search: { week } });
  };
  const selected = plan.courier;
  const pending = plan.tasks.filter((task) => !task.is_completed && task.courier === selected);
  const options = ids
    .filter((id) => id !== selected)
    .map((id) => ({ id, name: nameOf(id), load: plan.loads.get(id)?.get(plan.day) ?? 0 }));
  const title = t("scheduling.plan.title", { week: weekNumberOf(plan.week) });
  return (
    <DetailPage
      title={title}
      description={t("scheduling.plan.description")}
      actions={
        <>
          <Button
            variant="secondary"
            leadingIcon={<ChevronLeft aria-hidden="true" />}
            onClick={() => {
              goToWeek(addDays(plan.week, -7));
            }}
          >
            {t("scheduling.plan.previousWeek")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              void navigate({ to: ".", search: {} });
            }}
          >
            {t("scheduling.plan.thisWeek")}
          </Button>
          <Button
            variant="secondary"
            leadingIcon={<ChevronRight aria-hidden="true" />}
            onClick={() => {
              goToWeek(addDays(plan.week, 7));
            }}
          >
            {t("scheduling.plan.nextWeek")}
          </Button>
          {can("schedule.manage") && (
            <Button
              leadingIcon={<CalendarPlus aria-hidden="true" />}
              loading={generate.isPending}
              onClick={() => {
                generate.mutate(plan.week);
              }}
            >
              {t("scheduling.generate.action")}
            </Button>
          )}
        </>
      }
    >
      {plan.isError ? (
        <ErrorState onRetry={plan.refetch} />
      ) : (
        <>
          <ScheduleMatrix plan={plan} nameOf={nameOf} />
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
        </>
      )}
    </DetailPage>
  );
}
