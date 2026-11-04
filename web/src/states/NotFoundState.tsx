import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { classNames } from "../styles/class-names";
import buttons from "../styles/button.module.css";
import { useDocumentTitle } from "../shell/use-document-title";
import styles from "../styles/page.module.css";

/** Unknown address: say so, and offer the way home. Rendered inside the shell. */
export function NotFoundState() {
  const { t } = useTranslation();
  useDocumentTitle(t("states.notFound.title"));
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>{t("states.notFound.title")}</h1>
      <p className={styles.body}>{t("states.notFound.body")}</p>
      <div className={styles.actions}>
        <Link to="/" className={classNames(buttons.button, buttons.primary)}>
          {t("common.actions.goHome")}
        </Link>
      </div>
    </section>
  );
}
