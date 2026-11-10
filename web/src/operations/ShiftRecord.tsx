import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { Refreshing } from "../ui/Refreshing";
import { Button } from "../ui/Button";
import page from "../styles/page.module.css";
import { useShiftRecord } from "./use-shift-record";
import { ShiftSummary } from "./ShiftSummary";
import { ShiftTimeline } from "./ShiftTimeline";
import { ShiftHistory } from "./ShiftHistory";
import { ShiftActions } from "./ShiftActions";
export function ShiftRecord({ id }: { id: string }) {
  const { t } = useTranslation();
  const { query, refresh, isReady, canValidate } = useShiftRecord(id);
  if (!query.data) return query.isError ? <ErrorState onRetry={refresh} /> : <CardSkeleton />;
  const { shift, readSequence } = query.data;
  if (shift === null) return <ErrorState onRetry={refresh} />;
  return (
    <section className={page.page}>
      <Link to="/operations/shifts">{t("shift.page.title")}</Link>
      <h1 className={page.title}>{t("shift.page.detail")}</h1>
      <Button variant="secondary" onClick={refresh}>
        {t("shift.action.refresh")}
      </Button>
      {query.isFetching && <Refreshing />}
      {query.isError && <ErrorState onRetry={refresh} />}
      <ShiftSummary shift={shift} />
      {canValidate && <ShiftActions shift={shift} isReady={isReady} readSequence={readSequence} />}
      <ShiftTimeline shift={shift} />
      <ShiftHistory decisions={shift.validation_timeline} />
    </section>
  );
}
