import { Link } from "@tanstack/react-router";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DetailPage } from "../components/templates/DetailPage";
import { buttonVariants } from "../ui/button-variants";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { Refreshing } from "../ui/Refreshing";
import { Button } from "../ui/Button";
import { StatusPill } from "../ui/StatusPill";
import { useShiftRecord } from "./use-shift-record";
import { validationState } from "./shift-validation";
import { ShiftSummary } from "./ShiftSummary";
import { ShiftTimeline } from "./ShiftTimeline";
import { ShiftHistory } from "./ShiftHistory";
import { ShiftActions } from "./ShiftActions";

const STATE_KEYS = {
  open: "shift.status.open",
  pending: "shift.status.pending",
  approved: "shift.status.approved",
  observed: "shift.status.observed",
  outdated: "shift.status.outdated",
} as const;

export function ShiftRecord({ id }: { id: string }) {
  const { t } = useTranslation();
  const { query, refresh, isReady, canValidate } = useShiftRecord(id);
  if (!query.data) return query.isError ? <ErrorState onRetry={refresh} /> : <CardSkeleton />;
  const { shift, readSequence } = query.data;
  if (shift === null) return <ErrorState onRetry={refresh} />;
  const state = validationState(shift);
  return (
    <DetailPage
      title={t("shift.page.detail")}
      status={
        <StatusPill tone={state === "approved" ? "success" : state === "open" ? "info" : "warning"}>
          {t(STATE_KEYS[state])}
        </StatusPill>
      }
      actions={
        <>
          <Link to="/operations/shifts" className={buttonVariants({ variant: "tertiary" })}>
            <ArrowLeft aria-hidden="true" />
            {t("shift.page.title")}
          </Link>
          <Button
            variant="secondary"
            leadingIcon={<RefreshCw aria-hidden="true" />}
            onClick={refresh}
          >
            {t("shift.action.refresh")}
          </Button>
        </>
      }
      notices={
        <>
          {query.isFetching && <Refreshing />}
          {query.isError && <ErrorState onRetry={refresh} />}
        </>
      }
      aside={
        canValidate && <ShiftActions shift={shift} isReady={isReady} readSequence={readSequence} />
      }
    >
      <ShiftSummary shift={shift} />
      <ShiftTimeline shift={shift} />
      <ShiftHistory decisions={shift.validation_timeline} />
    </DetailPage>
  );
}
