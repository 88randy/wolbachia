import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../shell/use-document-title";
import styles from "../styles/page.module.css";

/** W1 sign-in. The form lands in the next commit; the route and its search are already real. */
export function LoginPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("auth.login.title"));
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t("auth.login.title")}</h1>
    </main>
  );
}
