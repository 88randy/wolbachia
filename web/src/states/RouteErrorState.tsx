import { Link } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { classNames } from "../styles/class-names";
import buttons from "../styles/button.module.css";
import { useDocumentTitle } from "../shell/use-document-title";
import { Card } from "../ui/Card";
import { ErrorState } from "../ui/ErrorState";
import styles from "../styles/page.module.css";
/** Keep the existing reset and home actions while scoping recovery to a shared error surface. */
export function RouteErrorState({ error, reset }: ErrorComponentProps) {
  const { t } = useTranslation();
  useDocumentTitle(t("states.error.title"));
  useEffect(() => {
    console.error("A route failed to render", error);
  }, [error]);
  return (
    <section className={styles.page}>
      <Card title={t("states.error.title")} headingLevel={1}>
        <ErrorState message={t("states.error.body")} onRetry={reset} />
        <Link to="/" className={classNames(buttons.button, buttons.secondary)}>
          {t("common.actions.goHome")}
        </Link>
      </Card>
    </section>
  );
}
