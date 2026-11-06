import { useTranslation } from "react-i18next";
import { blockedReasonKey } from "./motorcycle-status";
import styles from "./fleet.module.css";
import { Card } from "../ui/Card";
import type { Motorcycle } from "./fleet-query";
import { FleetRecordFeedback } from "./FleetRecordFeedback";
import { MotorcycleActions } from "./MotorcycleActions";
import { MotorcycleStatusBadge } from "./MotorcycleStatusBadge";
interface Props {
  motorcycle: Motorcycle;
  error: unknown;
  onRetry: () => void;
  isRefreshing: boolean;
}
/** Keep readiness and actions tied to the same verified record, including during refresh. */
export function MotorcycleRecordHeader({ motorcycle, error, onRetry, isRefreshing }: Props) {
  const { t } = useTranslation();
  const isVerified = error === null && !isRefreshing;
  const badge = isVerified ? <MotorcycleStatusBadge motorcycle={motorcycle} compact /> : undefined;
  return (
    <Card
      title={<span className={styles.code}>{motorcycle.code}</span>}
      headingLevel={1}
      actions={badge}
    >
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
