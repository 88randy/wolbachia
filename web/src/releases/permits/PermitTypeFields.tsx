import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import type { PermitTypeDraft } from "./permit-type-draft";
import type { usePermitTypeForm } from "./use-permit-type-form";

type Form = ReturnType<typeof usePermitTypeForm>;

const FIELDS = [
  { field: "code", label: "permits.typeForm.code", max: 50 },
  { field: "name", label: "permits.typeForm.name", max: 200 },
  { field: "gps", label: "permits.typeForm.gps", max: 20 },
] as const satisfies readonly { field: keyof PermitTypeDraft; label: string; max: number }[];

/** Code, name and the one requirement a type carries (maximum GPS accuracy). */
export function PermitTypeFields({ form }: { form: Form }) {
  const { t } = useTranslation();
  const id = useId();
  return FIELDS.map(({ field, label, max }) => {
    const error = form.errors[field];
    return (
      <TextField
        key={field}
        id={`${id}-${field}`}
        label={t(label)}
        {...(field === "gps" ? { hint: t("permits.typeForm.gpsHint"), inputMode: "decimal" } : {})}
        value={form.draft[field]}
        maxLength={max}
        required
        disabled={form.isBusy}
        error={error === undefined ? undefined : t(error)}
        onChange={(event) => {
          form.change(field, event.currentTarget.value);
        }}
      />
    );
  });
}
