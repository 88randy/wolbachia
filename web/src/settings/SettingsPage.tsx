import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { useDocumentTitle } from "../shell/use-document-title";
import styles from "../styles/page.module.css";
import { PHONES_PERMISSION } from "./settings-screens";

/**
 * Settings home: still a placeholder for the screens that do not exist, plus a link to each one
 * that does and that the user may open (hidden otherwise, never a dead link).
 */
export function SettingsPage() {
  const { t } = useTranslation();
  const can = useCan();
  useDocumentTitle(t("shell.nav.settings"));
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>{t("shell.nav.settings")}</h1>
      <p className={styles.body}>{t("states.placeholder.body")}</p>
      {can(PHONES_PERMISSION) && (
        <ul>
          <li>
            <Link to="/settings/phones">{t("phones.page.title")}</Link>
          </li>
        </ul>
      )}
    </section>
  );
}
