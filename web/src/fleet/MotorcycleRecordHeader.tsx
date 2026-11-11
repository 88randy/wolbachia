import { useTranslation } from "react-i18next";
import { InlineNotice } from "../ui/InlineNotice";
import { blockedReasonKey } from "./motorcycle-status";
import type { Motorcycle } from "./fleet-query";
import { FleetRecordFeedback } from "./FleetRecordFeedback";

export interface HeaderProps {
  motorcycle: Motorcycle;
  error: unknown;
  onRetry: () => void;
  isRefreshing: boolean;
}

/** Keep readiness tied to the same verified record, including during refresh. */
export function MotorcycleNotices({ motorcycle, error, onRetry, isRefreshing }: HeaderProps) {
  const { t } = useTranslation();
  const isVerified = error === null && !isRefreshing;
  return (
    <>
      {isVerified && motorcycle.is_blocked && (
        <InlineNotice tone="warning">
          {t("fleet.status.blocked")} · {t(blockedReasonKey(motorcycle))}
        </InlineNotice>
      )}
      {motorcycle.voided_at !== null && (
        <InlineNotice tone="info">{t("fleet.action.voided")}</InlineNotice>
      )}
      <FleetRecordFeedback error={error} onRetry={onRetry} isRefreshing={isRefreshing} />
    </>
  );
}
