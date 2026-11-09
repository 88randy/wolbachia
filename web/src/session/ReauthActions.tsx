import { useTranslation } from "react-i18next";
import { ServiceFailureAlert } from "../forms/ServiceFailureAlert";
import { SubmitButton } from "../forms/SubmitButton";
import { DialogFooter } from "../ui/DialogFooter";
import { Button } from "../ui/Button";
import { useSignOut } from "./use-sign-out";

/**
 * Continue (submit) or sign out: the two ways out of the re-authentication dialog. Each shows
 * busy while it runs (they are queued, never rejected), and a failed sign-out is reported.
 */
export function ReauthActions({ isSubmitting }: { isSubmitting: boolean }) {
  const { t } = useTranslation();
  const { signOut, isBusy, failure } = useSignOut();
  return (
    <>
      <ServiceFailureAlert id="reauth-sign-out-alert" failure={failure} />
      <DialogFooter>
        <Button
          variant="secondary"
          type="button"
          aria-disabled={isBusy}
          onClick={() => {
            if (!isBusy) void signOut();
          }}
        >
          {t("auth.session.signOut")}
        </Button>
        <SubmitButton
          label={t("auth.session.submit")}
          busyLabel={t("auth.login.submitting")}
          isBusy={isSubmitting}
        />
      </DialogFooter>
    </>
  );
}
