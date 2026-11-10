import { useTranslation } from "react-i18next";
import { PermitFormActions } from "./PermitFormActions";
import { PermitModal } from "./PermitModal";
import type { Permit } from "./permits-query";
import styles from "./permits.module.css";
import { SuspendFailure } from "./SuspendFailure";
import { SuspendReasonField } from "./SuspendReasonField";
import { SuspendZone } from "./SuspendZone";
import { useSuspendPermit } from "./use-suspend-permit";

interface Props {
  permit: Permit;
  onClose: () => void;
  onSuspended: () => void;
}

/** W45 "Suspend now": immediate effect, affected zone, a required reason and the offline note. */
export function SuspendDialog({ permit, onClose, onSuspended }: Props) {
  const { t } = useTranslation();
  const form = useSuspendPermit(permit, onSuspended);
  return (
    <PermitModal
      title={t("permits.suspend.title", { code: permit.code })}
      description={t("permits.suspend.description")}
      isBusy={form.isBusy}
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={form.send} noValidate>
        <SuspendZone permit={permit} />
        <SuspendReasonField
          value={form.reason}
          hasError={form.reasonError}
          isBusy={form.isBusy}
          onChange={form.setReason}
        />
        <p className={styles.note}>{t("permits.suspend.syncNote")}</p>
        <SuspendFailure failure={form.failure} />
        <PermitFormActions
          isBusy={form.isBusy}
          onClose={onClose}
          labels={{ submit: "permits.suspend.submit", busy: "permits.suspend.busy" }}
        />
      </form>
    </PermitModal>
  );
}
