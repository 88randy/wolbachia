import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import type { DiscrepancyRecordState } from "./discrepancy-use-record";
import { DiscrepancyRetryActions } from "./DiscrepancyRetryActions";

export function DiscrepancyCommandNotice({ state }: { state: DiscrepancyRecordState }) {
  const { t } = useTranslation();
  const status = state.command.status;
  if (!status || state.command.isBusy) return null;
  if (status.phase === "saved") return <p role="status">{t("discrepancies.close.saved")}</p>;
  return (
    <InlineNotice tone="warning">
      <div role="alert">
        {t(
          status.failure?.uncertain
            ? "discrepancies.close.uncertain"
            : "discrepancies.close.failed",
        )}
      </div>
      {status.failure && <p>{t(status.failure.key)}</p>}
      {status.failure?.reasons.map((reason) => (
        <p key={reason}>{t(reason)}</p>
      ))}
      <DiscrepancyRetryActions state={state} />
    </InlineNotice>
  );
}
