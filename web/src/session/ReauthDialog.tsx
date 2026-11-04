import { useTranslation } from "react-i18next";
import styles from "./SessionExpiredDialog.module.css";
import { ReauthForm } from "./ReauthForm";
import { useModalDialog } from "./use-modal-dialog";

const TITLE_ID = "reauth-title";
const BODY_ID = "reauth-body";

/**
 * Modal asking the signed-in user for their password again. Escape does not dismiss it: closing
 * it without signing in again would leave a page whose requests all fail; "Sign out" is the way
 * out. The page behind stays mounted, so drafts survive.
 */
export function ReauthDialog() {
  const { t } = useTranslation();
  const dialogRef = useModalDialog("input[type=password]");
  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={TITLE_ID}
      aria-describedby={BODY_ID}
      onCancel={(event) => {
        event.preventDefault();
      }}
    >
      <h2 id={TITLE_ID} className={styles.title}>
        {t("auth.session.title")}
      </h2>
      <p id={BODY_ID} className={styles.body}>
        {t("auth.session.body")}
      </p>
      <ReauthForm />
    </dialog>
  );
}
