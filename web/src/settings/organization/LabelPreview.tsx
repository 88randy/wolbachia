import { useTranslation } from "react-i18next";
import type { Organization } from "./use-w-03";
import { LogoMark } from "./LogoMark";
import styles from "./organization.module.css";
export function LabelPreview({ settings }: { settings: Organization }) {
  const { t } = useTranslation();
  return (
    <aside className={styles.card} aria-label={t("orgAdmin.brand.preview")}>
      <h2>{t("orgAdmin.brand.preview")}</h2>
      <div className={styles.label}>
        <LogoMark name={settings.name} url={settings.logo_url} revision={settings.revision} />
        <strong>{settings.name}</strong>
        <p className={styles.warning}>{t("orgAdmin.brand.inUse")}</p>
        <span>{settings.label_phone}</span>
      </div>
      <p>{t("orgAdmin.brand.hint")}</p>
    </aside>
  );
}
