import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AreaId } from "../router/areas";
import { useDocumentTitle } from "../shell/use-document-title";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";
import { Card } from "../ui/Card";
import styles from "./NoPermissionState.module.css";
/** A missing permission names the area and who can help; it never offers a restricted action. */
export function NoPermissionState({ areaId }: { areaId: AreaId }) {
  const { t } = useTranslation();
  useDocumentTitle(t("states.noPermission.title"));
  return (
    <Card title={t("states.noPermission.title")} headingLevel={1} className={styles.state}>
      <Lock aria-hidden="true" className={styles.icon} strokeWidth={1.5} />
      <p className={styles.body}>{t("states.noPermission.body")}</p>
      <dl className={styles.card}>
        <dt className={styles.term}>{t("states.noPermission.area")}</dt>
        <dd className={styles.value}>{t(`shell.nav.${areaId}`)}</dd>
      </dl>
      <Link to="/" className={classNames(buttons.button, buttons.primary)}>
        {t("common.actions.goHome")}
      </Link>
    </Card>
  );
}
