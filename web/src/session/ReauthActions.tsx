import { useTranslation } from "react-i18next";
import { SubmitButton } from "../forms/SubmitButton";
import styles from "./SessionExpiredDialog.module.css";
import { useSignOut } from "./use-sign-out";

/** Continue (submit) or sign out: the two ways out of the re-authentication dialog. */
export function ReauthActions({ isSubmitting }: { isSubmitting: boolean }) {
  const { t } = useTranslation();
  const { signOut, isBusy } = useSignOut();
  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.signOut}
        aria-disabled={isBusy}
        onClick={() => {
          if (!isBusy) void signOut();
        }}
      >
        {t("auth.session.signOut")}
      </button>
      <SubmitButton
        label={t("auth.session.submit")}
        busyLabel={t("auth.login.submitting")}
        isBusy={isSubmitting}
      />
    </div>
  );
}
