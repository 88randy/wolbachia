import { Link, useRouter } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { classNames } from "../styles/class-names";
import buttons from "../styles/button.module.css";
import { useDocumentTitle } from "../shell/use-document-title";
import { Card } from "../ui/Card";
import { ErrorState } from "../ui/ErrorState";
import styles from "../styles/page.module.css";
/**
 * Retry re-runs the guards and loaders (`router.invalidate`, which also resets the boundary): a
 * plain `reset` would render the same failed load again.
 */
export function RouteErrorState({ error }: ErrorComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();
  useDocumentTitle(t("states.error.title"));
  useEffect(() => {
    console.error("A route failed to render", error);
  }, [error]);
  return (
    <section className={styles.page}>
      <Card title={t("states.error.title")} headingLevel={1}>
        <ErrorState message={t("states.error.body")} onRetry={() => void router.invalidate()} />
        <Link to="/" className={classNames(buttons.button, buttons.secondary)}>
          {t("common.actions.goHome")}
        </Link>
      </Card>
    </section>
  );
}
