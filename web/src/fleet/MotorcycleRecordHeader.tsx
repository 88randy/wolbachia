import { useTranslation } from "react-i18next";
import { blockedReasonKey } from "./motorcycle-status";
import styles from "./fleet.module.css";
import { Card } from "../ui/Card";
import type { Motorcycle } from "./fleet-query";
import { FleetRecordFeedback } from "./FleetRecordFeedback";
import { MotorcycleActions } from "./MotorcycleActions";
import { MotorcycleStatusBadge } from "./MotorcycleStatusBadge";
import { Button } from "../ui/Button";
interface Props {
  motorcycle: Motorcycle;
  error: unknown;
  onRetry: () => void;
  isRefreshing: boolean;
}
function HeaderActions({ motorcycle, error, onRetry, isRefreshing }: Props) {
  const { t } = useTranslation();
  const isVerified = error === null && !isRefreshing;
  return (
    <div className={styles.actions}>
      {isVerified && <MotorcycleStatusBadge motorcycle={motorcycle} compact />}
      <Button
        id={`fleet-record-refresh-${motorcycle.id}`}
        variant="secondary"
        aria-disabled={isRefreshing}
        onClick={onRetry}
      >
        {t("fleet.action.refresh")}
      </Button>
    </div>
  );
}
/** Keep readiness and actions tied to the same verified record, including during refresh. */
export function MotorcycleRecordHeader(props: Props) {
  const { motorcycle, error, onRetry, isRefreshing } = props;
  const { t } = useTranslation();
  const isVerified = error === null && !isRefreshing;
  return (
    <Card title={<span className={styles.code}>{motorcycle.code}</span>} headingLevel={1}>
      <HeaderActions {...props} />
      {isVerified && motorcycle.is_blocked && (
        <p className={styles.hint}>
          <span>{t("fleet.status.blocked")}</span> · {t(blockedReasonKey(motorcycle))}
        </p>
      )}
      <FleetRecordFeedback error={error} onRetry={onRetry} isRefreshing={isRefreshing} />
      <MotorcycleActions motorcycle={motorcycle} isUnverified={error !== null || isRefreshing} />
    </Card>
  );
}
