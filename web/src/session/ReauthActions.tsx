import { useTranslation } from "react-i18next";
import { ServiceFailureAlert } from "../forms/ServiceFailureAlert";
import { SubmitButton } from "../forms/SubmitButton";
import { usePendingAuthOperation } from "./auth-operation";
import styles from "./SessionExpiredDialog.module.css";
import { useSignOut } from "./use-sign-out";

/**
 * Continue (submit) or sign out: the two ways out of the re-authentication dialog. Each is
 * disabled while the other is running, and a failed sign-out is reported.
 */
export function ReauthActions({ isSubmitting }: { isSubmitting: boolean }) {
  const { t } = useTranslation();
  const { signOut, isBusy, failure } = useSignOut();
  const pending = usePendingAuthOperation();
  return (
    <>
      <ServiceFailureAlert id="reauth-sign-out-alert" failure={failure} />
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
          isBusy={isSubmitting || pending === "logout"}
        />
      </div>
    </>
  );
}
