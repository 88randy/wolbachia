import { useTranslation } from "react-i18next";
import { FormField, FormGrid } from "../../../components/templates/FormGrid";
import { TextField } from "../../../forms/TextField";
import type { CenterFormState } from "./use-center-form";

interface FieldProps {
  form: CenterFormState;
  isEdit: boolean;
}

function CodeField({ form, isEdit }: FieldProps) {
  const { t } = useTranslation();
  return (
    <TextField
      id="center-code"
      label={t("centersAdmin.form.code")}
      value={form.code}
      maxLength={50}
      required
      disabled={isEdit}
      autoCapitalize="characters"
      hint={t(isEdit ? "centersAdmin.form.codeLocked" : "centersAdmin.form.codeHint")}
      error={form.codeError}
      onChange={(event) => {
        form.setCode(event.currentTarget.value);
      }}
    />
  );
}

/** Name (wide) and code (short, uppercase, locked once created). */
export function CenterFormFields({ form, isEdit }: FieldProps) {
  const { t } = useTranslation();
  return (
    <FormGrid columns={3}>
      <FormField width="full">
        <TextField
          id="center-name"
          label={t("centersAdmin.form.name")}
          value={form.name}
          maxLength={200}
          required
          error={form.nameError}
          onChange={(event) => {
            form.setName(event.currentTarget.value);
          }}
        />
      </FormField>
      <FormField width="medium">
        <CodeField form={form} isEdit={isEdit} />
      </FormField>
    </FormGrid>
  );
}
