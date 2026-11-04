import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AreaId } from "../router/areas";
import { useDocumentTitle } from "../shell/use-document-title";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";
import styles from "./NoPermissionState.module.css";

/**
 * The user opened an area their permissions do not include. It is a normal state, not a crash:
 * it names the section, says who can help and offers the way home. Rendered inside the shell.
 */
export function NoPermissionState({ areaId }: { areaId: AreaId }) {
  const { t } = useTranslation();
  useDocumentTitle(t("states.noPermission.title"));
  return (
    <section className={styles.state}>
      <Lock aria-hidden="true" className={styles.icon} />
      <h1 className={styles.title}>{t("states.noPermission.title")}</h1>
      <p className={styles.body}>{t("states.noPermission.body")}</p>
      <dl className={styles.card}>
        <dt className={styles.term}>{t("states.noPermission.area")}</dt>
        <dd className={styles.value}>{t(`shell.nav.${areaId}`)}</dd>
      </dl>
      <Link to="/" className={classNames(buttons.button, buttons.primary)}>
        {t("common.actions.goHome")}
      </Link>
    </section>
  );
}
