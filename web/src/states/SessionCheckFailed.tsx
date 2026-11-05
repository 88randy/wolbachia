import { useTranslation } from "react-i18next";
import { useRetrySession } from "../session/use-retry-session";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";
import styles from "../styles/page.module.css";

/**
 * Blocking state of an UNKNOWN session (#82): the check of `/me/` failed after another tab changed
 * the shared session, so this tab does not know who is signed in. Nothing of the organization is
 * shown or sent until the user retries and `/me/` answers; it never falls back to the old identity.
 */
export function SessionCheckFailed() {
  const { t } = useTranslation();
  const { retry, isBusy } = useRetrySession();
  return (
    <section className={styles.page} role="alert">
      <h1 className={styles.title}>{t("states.sessionCheck.title")}</h1>
      <p className={styles.body}>{t("states.sessionCheck.body")}</p>
      <div className={styles.actions}>
        <button
          type="button"
          className={classNames(buttons.button, buttons.primary)}
          data-initial-focus
          aria-disabled={isBusy}
          onClick={() => {
            void retry();
          }}
        >
          {t("common.actions.retry")}
        </button>
      </div>
    </section>
  );
}
