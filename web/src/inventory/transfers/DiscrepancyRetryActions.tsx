import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { useRetryWindow } from "../../quadrants/geography/use-retry-window";
import type { DiscrepancyRecordState } from "./discrepancy-use-record";

export function DiscrepancyRetryActions({ state }: { state: DiscrepancyRecordState }) {
  const { t } = useTranslation();
  const failure = state.command.status?.failure;
  const isWaiting = useRetryWindow(failure?.retryAt ?? 0);
  const isRetryBlocked = !state.isFresh || !state.isOnline || isWaiting;
  const isRefreshBlocked = state.query.isFetching || !state.isOnline;
  return (
    <>
      {!failure?.conflict && (
        <Button
          variant="secondary"
          aria-disabled={isRetryBlocked}
          onClick={() => void state.command.retry()}
        >
          {t("discrepancies.close.retry")}
        </Button>
      )}
      <Button
        variant="secondary"
        aria-disabled={isRefreshBlocked}
        onClick={() => void state.refresh()}
      >
        {t("discrepancies.close.review")}
      </Button>
    </>
  );
}
