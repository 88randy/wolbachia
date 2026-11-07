import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../shell/use-document-title";
import { SettingsLinks } from "./SettingsLinks";
import styles from "../styles/page.module.css";
export function SettingsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("shell.nav.settings"));
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>{t("shell.nav.settings")}</h1>
      <p className={styles.body}>{t("refresh.settings.description")}</p>
      <SettingsLinks />
    </section>
  );
}
