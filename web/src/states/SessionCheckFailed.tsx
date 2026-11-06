import { useTranslation } from "react-i18next";
import { useRetrySession } from "../session/use-retry-session";
import { Button } from "../ui/Button";
import styles from "../styles/page.module.css";
/** The session stays blocked until the existing controller obtains a trusted identity. */
export function SessionCheckFailed() {
  const { t } = useTranslation();
  const { retry, isBusy } = useRetrySession();
  return (
    <section className={styles.page} role="alert">
      <h1 className={styles.title}>{t("states.sessionCheck.title")}</h1>
      <p className={styles.body}>{t("states.sessionCheck.body")}</p>
      <div className={styles.actions}>
        <Button
          loading={isBusy}
          data-initial-focus
          onClick={() => {
            void retry();
          }}
        >
          {t("common.actions.retry")}
        </Button>
      </div>
    </section>
  );
}
