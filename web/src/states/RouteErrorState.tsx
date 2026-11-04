import { Link } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { classNames } from "../styles/class-names";
import buttons from "../styles/button.module.css";
import styles from "../styles/page.module.css";

/** A screen failed to render: blameless message, retry and a way home. The error is logged. */
export function RouteErrorState({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  useEffect(() => {
    console.error("A route failed to render", error);
  }, [error]);
  return (
    <section className={styles.page} role="alert">
      <h1 className={styles.title}>{t("states.error.title")}</h1>
      <p className={styles.body}>{t("states.error.body")}</p>
      <div className={styles.actions}>
        <button
          type="button"
          className={classNames(buttons.button, buttons.primary)}
          onClick={reset}
        >
          {t("common.actions.retry")}
        </button>
        <Link to="/" className={classNames(buttons.button, buttons.secondary)}>
          {t("common.actions.goHome")}
        </Link>
      </div>
    </section>
  );
}
