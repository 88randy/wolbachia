import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { TextField } from "../../forms/TextField";
import type { PermitDraft } from "./permit-draft";
import type { usePermitForm } from "./use-permit-form";

type Form = ReturnType<typeof usePermitForm>;

interface Spec {
  field: keyof PermitDraft;
  label: MessageKey;
  max: number;
  type?: "datetime-local";
}

const SPECS = {
  code: { field: "code", label: "permits.form.code", max: 50 },
  number: { field: "number", label: "permits.form.number", max: 100 },
  authority: { field: "authority", label: "permits.form.authority", max: 300 },
  attestation: { field: "attestation", label: "permits.form.attestation", max: 1000 },
  validFrom: {
    field: "validFrom",
    label: "permits.form.validFrom",
    max: 16,
    type: "datetime-local",
  },
  validTo: { field: "validTo", label: "permits.form.validTo", max: 16, type: "datetime-local" },
} as const satisfies Record<string, Spec>;

interface Props {
  form: Form;
  names: readonly (keyof typeof SPECS)[];
}

/** Plain text and date inputs of the permit form, one per requested name. */
export function PermitTextFields({ form, names }: Props) {
  const { t } = useTranslation();
  const id = useId();
  return names.map((name) => {
    const spec: Spec = SPECS[name];
    const error = form.errors[spec.field];
    return (
      <TextField
        key={name}
        id={`${id}-${name}`}
        type={spec.type ?? "text"}
        label={t(spec.label)}
        value={form.draft[spec.field]}
        maxLength={spec.max}
        required
        disabled={form.isBusy}
        error={error === undefined ? undefined : t(error)}
        onChange={(event) => {
          form.change(spec.field, event.currentTarget.value);
        }}
      />
    );
  });
}
