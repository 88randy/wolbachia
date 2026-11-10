import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "../../forms/Select";
import type { usePermitForm } from "./use-permit-form";

type Form = ReturnType<typeof usePermitForm>;

/** Type or quadrant picker: the options are the server's own lists, already inside the scope. */
export function PermitChoiceField({ form, field }: { form: Form; field: "type" | "quadrant" }) {
  const { t } = useTranslation();
  const id = useId();
  const rows = (field === "type" ? form.choices?.types : form.choices?.quadrants) ?? [];
  const error = form.errors[field];
  return (
    <Select
      id={id}
      label={t(field === "type" ? "permits.form.type" : "permits.form.quadrant")}
      value={form.draft[field]}
      required
      disabled={form.isBusy}
      {...(error === undefined ? {} : { error: t(error) })}
      options={[
        {
          value: "",
          label: t(
            field === "type" ? "permits.form.typePlaceholder" : "permits.form.quadrantPlaceholder",
          ),
        },
        ...rows.map((row) => ({ value: row.id, label: row.code })),
      ]}
      onChange={(event) => {
        form.change(field, event.currentTarget.value);
      }}
    />
  );
}
