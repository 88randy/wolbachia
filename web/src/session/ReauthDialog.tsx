import { useTranslation } from "react-i18next";
import { isSessionExpired } from "./session-events";
import styles from "./SessionExpiredDialog.module.css";
import { ReauthForm } from "./ReauthForm";
import { useModalDialog } from "./use-modal-dialog";

const TITLE_ID = "reauth-title";
const PASSWORD_FIELD = "input[type=password]";
const BODY_ID = "reauth-body";

/**
 * Browsers that apply the close-watcher rule close a modal `<dialog>` on a second Escape even when
 * the first `cancel` was prevented. While the session is still expired it is opened again at once.
 *
 * Modal asking the signed-in user for their password again. Escape does not dismiss it: closing
 * it without signing in again would leave a page whose requests all fail; "Sign out" is the way
 * out. The page behind stays mounted, so drafts survive.
 */
export function ReauthDialog() {
  const { t } = useTranslation();
  const dialogRef = useModalDialog(PASSWORD_FIELD);
  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={TITLE_ID}
      aria-describedby={BODY_ID}
      onCancel={(event) => {
        event.preventDefault();
      }}
      onClose={(event) => {
        const dialog = event.currentTarget;
        if (!isSessionExpired() || !dialog.isConnected || dialog.open) return;
        dialog.showModal();
        dialog.querySelector<HTMLElement>(PASSWORD_FIELD)?.focus();
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
