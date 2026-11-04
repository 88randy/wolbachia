import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../shell/use-document-title";
import styles from "../styles/page.module.css";

/** Organization choice for users with several memberships. The list lands in a later commit. */
export function SelectOrganizationPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("auth.organization.title"));
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t("auth.organization.title")}</h1>
    </main>
  );
}
