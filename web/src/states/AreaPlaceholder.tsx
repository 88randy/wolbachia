import { useTranslation } from "react-i18next";
import type { AreaId } from "../router/areas";
import { useDocumentTitle } from "../shell/use-document-title";
import styles from "../styles/page.module.css";

/** Stand-in for an area whose screens are not built yet: its name and an honest notice. */
export function AreaPlaceholder({ areaId }: { areaId: AreaId }) {
  const { t } = useTranslation();
  useDocumentTitle(t(`shell.nav.${areaId}`));
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>{t(`shell.nav.${areaId}`)}</h1>
      <p className={styles.body}>{t("states.placeholder.body")}</p>
    </section>
  );
}
