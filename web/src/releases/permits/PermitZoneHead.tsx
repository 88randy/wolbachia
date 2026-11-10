import { useTranslation } from "react-i18next";
import styles from "./permits.module.css";

/** Column headers of the zone table. */
export function PermitZoneHead() {
  const { t } = useTranslation();
  return (
    <thead>
      <tr>
        <th scope="col">{t("permits.zone.vertex")}</th>
        <th scope="col" className={styles.number}>
          {t("permits.zone.longitude")}
        </th>
        <th scope="col" className={styles.number}>
          {t("permits.zone.latitude")}
        </th>
      </tr>
    </thead>
  );
}
