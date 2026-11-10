import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { InlineNotice } from "../ui/InlineNotice";
import { Button } from "../ui/Button";
import { blockedReasonKey } from "./motorcycle-status";
import type { Motorcycle } from "./fleet-query";
import { FleetRecordFeedback } from "./FleetRecordFeedback";
import { MotorcycleActions } from "./MotorcycleActions";

export interface HeaderProps {
  motorcycle: Motorcycle;
  error: unknown;
  onRetry: () => void;
  isRefreshing: boolean;
}

/** Back to the list and refresh; the status pill and the record actions sit beside them. */
export function MotorcycleHeaderActions(
  props: HeaderProps & { listSearch: Record<string, string> },
) {
  const { motorcycle, error, onRetry, isRefreshing, listSearch } = props;
  const { t } = useTranslation();
  return (
    <>
      <Link
        to="/fleet/motorcycles"
        search={listSearch}
        className="inline-flex min-h-8 items-center gap-1 text-sm font-semibold text-action"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("fleet.record.back")}
      </Link>
      <Button
        id={`fleet-record-refresh-${motorcycle.id}`}
        variant="secondary"
        aria-disabled={isRefreshing}
        onClick={onRetry}
      >
        {t("fleet.action.refresh")}
      </Button>
      <MotorcycleActions motorcycle={motorcycle} isUnverified={error !== null || isRefreshing} />
    </>
  );
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
      <FleetRecordFeedback error={error} onRetry={onRetry} isRefreshing={isRefreshing} />
    </>
  );
}
