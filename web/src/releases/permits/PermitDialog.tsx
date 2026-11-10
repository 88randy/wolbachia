import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FormAlert } from "../../forms/FormAlert";
import { PermitFormActions } from "./PermitFormActions";
import { PermitFormFields } from "./PermitFormFields";
import { PermitModal } from "./PermitModal";
import type { Permit } from "./permits-query";
import styles from "./permits.module.css";
import { usePermitForm } from "./use-permit-form";

interface Props {
  /** Present when appending a version to an existing permit. */
  permit?: Permit;
  onClose: () => void;
  onSaved: () => void;
}

/** W44 creates a permit; W45 appends a version with the same form, guarded by the revision. */
export function PermitDialog({ permit, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const form = usePermitForm(permit, onSaved);
  const title = permit
    ? t("permits.form.titleVersion", { code: permit.code })
    : t("permits.form.titleCreate");
  return (
    <PermitModal title={title} isBusy={form.isBusy} onClose={onClose}>
      <form className={styles.form} onSubmit={form.send} noValidate>
        <PermitFormFields form={form} isVersion={permit !== undefined} />
        {form.alert !== undefined && (
          <FormAlert id={id} title={t("permits.form.failure")} text={t(form.alert)} />
        )}
        <PermitFormActions
          isBusy={form.isBusy}
          onClose={onClose}
          labels={{
            submit: permit ? "permits.form.submitVersion" : "permits.form.submitCreate",
            busy: "permits.form.busy",
          }}
        />
      </form>
    </PermitModal>
  );
}
