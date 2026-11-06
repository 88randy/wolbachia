import { useTranslation } from "react-i18next";
import { StatusPill } from "../ui/StatusPill";
import type { Motorcycle } from "./fleet-query";
import { blockedReasonKey, motorcycleStatus } from "./motorcycle-status";
import styles from "./fleet.module.css";
const TONES = { available: "success", blocked: "critical", voided: "neutral" } as const;
export function MotorcycleStatusBadge({
  motorcycle,
  compact = false,
}: {
  motorcycle: Motorcycle;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const status = motorcycleStatus(motorcycle);
  const label =
    compact && status === "blocked"
      ? "fleet.status.blockedShort"
      : (`fleet.status.${status}` as const);
  return (
    <div className={styles.content}>
      <StatusPill tone={TONES[status]}>{t(label)}</StatusPill>
      {!compact && motorcycle.is_blocked && <span>{t(blockedReasonKey(motorcycle))}</span>}
    </div>
  );
}
