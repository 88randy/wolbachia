import { useTranslation } from "react-i18next";
import { PermitZoneTable } from "./PermitZoneTable";
import styles from "./permits.module.css";

/** The official zone: always readable as a table, whatever a map would add on top. */
export function PermitZone({ geometry }: { geometry: unknown }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="permit-zone" className={styles.panel}>
      <h2 id="permit-zone" className={styles.panelTitle}>
        {t("permits.zone.title")}
      </h2>
      <p className={styles.muted}>{t("permits.zone.hint")}</p>
      <PermitZoneTable geometry={geometry} />
    </section>
  );
}
