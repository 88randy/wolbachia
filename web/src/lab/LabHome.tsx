import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { useDocumentTitle } from "../shell/use-document-title";
import styles from "../styles/page.module.css";
export function LabHome() {
  const { t } = useTranslation();
  const can = useCan();
  useDocumentTitle(t("shell.nav.lab"));
  return (
    <section className={styles.page}>
      <h1>{t("shell.nav.lab")}</h1>
      {can("bag.receive") && <Link to="/lab/bags">{t("labReception.page.title")}</Link>}
      {can("egg_count.create") && (
        <a href="/lab/egg-counts">{t("labReception.action.countQueue")}</a>
      )}
    </section>
  );
}
