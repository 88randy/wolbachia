import { useTranslation } from "react-i18next";
import type { Permit } from "./permits-query";
import styles from "./permits.module.css";

/** The zone whose releases stop at once: center and quadrant of the permit. */
export function SuspendZone({ permit }: { permit: Permit }) {
  const { t } = useTranslation();
  const zone = t("permits.column.zoneCell", {
    center: permit.center_code,
    quadrant: permit.quadrant_code,
  });
  return (
    <p className={styles.fact}>
      <span className={styles.muted}>{t("permits.suspend.zone")}</span>
      <strong>{zone}</strong>
    </p>
  );
}
