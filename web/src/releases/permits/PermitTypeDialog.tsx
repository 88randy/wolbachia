import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FormAlert } from "../../forms/FormAlert";
import { PermitFormActions } from "./PermitFormActions";
import { PermitModal } from "./PermitModal";
import { PermitTypeFields } from "./PermitTypeFields";
import styles from "./permits.module.css";
import { usePermitTypeForm } from "./use-permit-type-form";

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

/** W43: create a permit type (code, name and the one requirement the backend accepts). */
export function PermitTypeDialog({ onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const form = usePermitTypeForm(onCreated);
  return (
    <PermitModal title={t("permits.typeForm.title")} isBusy={form.isBusy} onClose={onClose}>
      <form className={styles.form} onSubmit={form.submit} noValidate>
        <PermitTypeFields form={form} />
        {form.alert !== undefined && (
          <FormAlert id={id} title={t("permits.typeForm.failure")} text={t(form.alert)} />
        )}
        <PermitFormActions
          isBusy={form.isBusy}
          onClose={onClose}
          labels={{ submit: "permits.typeForm.submit", busy: "permits.typeForm.busy" }}
        />
      </form>
    </PermitModal>
  );
}
