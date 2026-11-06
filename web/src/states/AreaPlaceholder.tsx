import { useTranslation } from "react-i18next";
import type { AreaId } from "../router/areas";
import { useDocumentTitle } from "../shell/use-document-title";
import { Card } from "../ui/Card";
import styles from "../styles/page.module.css";
/** An unbuilt area remains an honest placeholder; no nonfunctional create action is offered. */
export function AreaPlaceholder({ areaId }: { areaId: AreaId }) {
  const { t } = useTranslation();
  const title = t(`shell.nav.${areaId}`);
  useDocumentTitle(title);
  return (
    <section className={styles.page}>
      <Card title={title} headingLevel={1}>
        <p className={styles.body}>{t("states.placeholder.body")}</p>
      </Card>
    </section>
  );
}
