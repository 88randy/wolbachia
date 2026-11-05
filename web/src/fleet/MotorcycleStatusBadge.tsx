import { Ban, Check, CircleSlash } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Motorcycle } from "./fleet-query";
import { blockedReasonKey, motorcycleStatus } from "./motorcycle-status";
import styles from "./fleet.module.css";
const ICONS = { available: Check, blocked: Ban, voided: CircleSlash };
export function MotorcycleStatusBadge({ motorcycle }: { motorcycle: Motorcycle }) {
  const { t } = useTranslation();
  const status = motorcycleStatus(motorcycle);
  const Icon = ICONS[status];
  return (
    <div className={styles.content}>
      <span className={styles[status]}>
        <Icon className={styles.icon} aria-hidden="true" />
        {t(`fleet.status.${status}`)}
      </span>
      {motorcycle.is_blocked && <span>{t(blockedReasonKey(motorcycle))}</span>}
    </div>
  );
}
