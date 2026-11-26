import { CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageFrame } from "../components/templates/PageFrame";
import { PageHeader } from "../components/templates/PageHeader";
import { useFormatCalendarDate } from "../format/use-formatters";
import { useDocumentTitle } from "../shell/use-document-title";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { InfoHint } from "../ui/InfoHint";
import { InlineNotice } from "../ui/InlineNotice";
import { CycleStepCard } from "./CycleStepCard";
import { useCycleCards } from "./use-cycle-cards";
import { useCycleStatus } from "./use-cycle-status";
import { addDays, weekNumberOf } from "./week-dates";

/** Scheduling home: the weekly cycle in order, with how each step stands this week. */
export function SchedulingHome() {
  const { t } = useTranslation();
  const formatDay = useFormatCalendarDate();
  const status = useCycleStatus();
  const cards = useCycleCards(status.steps, status.facts);
  const title = t("shell.nav.scheduling");
  useDocumentTitle(title);
  const week = t("scheduling.home.week", {
    week: weekNumberOf(status.week),
    from: formatDay(status.week),
    to: formatDay(addDays(status.week, 6)),
  });
  const nextCard = cards.find((card) => card.id === status.next?.id);
  return (
    <PageFrame width="narrow">
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays aria-hidden="true" className="size-3.5" />
            {week}
          </span>
        }
        title={
          <span className="inline-flex items-center gap-1">
            {title}
            <InfoHint text={t("scheduling.home.hint")} />
          </span>
        }
        description={t("scheduling.home.description")}
      />
      {status.isError ? (
        <ErrorState onRetry={status.refetch} />
      ) : status.isLoading ? (
        <CardSkeleton />
      ) : (
        <>
          {nextCard ? (
            <InlineNotice tone="info">
              <p className="font-semibold">{t("scheduling.home.next", { step: nextCard.title })}</p>
            </InlineNotice>
          ) : status.isWaiting ? (
            <InlineNotice tone="info">
              <p className="font-semibold">{t("scheduling.home.waiting")}</p>
            </InlineNotice>
          ) : (
            <InlineNotice tone="success">
              <p className="font-semibold">{t("scheduling.home.allDone")}</p>
            </InlineNotice>
          )}
          <ol aria-label={week} className="m-0 flex list-none flex-col gap-4 p-0">
            {cards.map(({ id, ...card }, index) => (
              <CycleStepCard
                key={id}
                number={index + 1}
                isNext={id === status.next?.id}
                {...card}
              />
            ))}
          </ol>
        </>
      )}
    </PageFrame>
  );
}
