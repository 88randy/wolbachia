import { useTranslation } from "react-i18next";
import { useId } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { TextField } from "../forms/TextField";
import { Select } from "../forms/Select";
import { FieldNotes } from "../forms/FieldNotes";
import type { FleetDraft } from "./fleet-drafts";
import styles from "./fleet.module.css";
const fields: readonly { name: string; label: MessageKey; type: string; required?: boolean }[] = [
  { name: "performed_at", label: "fleet.service.date", type: "date", required: true },
  { name: "odometer_km", label: "fleet.service.odometer", type: "number", required: true },
  { name: "service_interval_km", label: "fleet.service.intervalKm", type: "number" },
  { name: "service_interval_days", label: "fleet.service.intervalDays", type: "number" },
];
interface FieldsProps {
  draft: FleetDraft;
  disabled: boolean;
  change: (name: string, value: string) => void;
  blur: (name: string) => void;
}
export function FleetServiceFields(props: FieldsProps) {
  const { disabled } = props;
  return (
    <fieldset disabled={disabled} className={styles.formFields}>
      <ServiceKind {...props} />
      {fields.map((field) => (
        <ServiceField key={field.name} field={field} {...props} />
      ))}
      <ServiceNotes {...props} />
    </fieldset>
  );
}
function ServiceKind({ draft, change, blur }: FieldsProps) {
  const { t } = useTranslation();
  const id = useId();
  const options = [
    { value: "", label: t("fleet.summary.unknown") },
    ...(["routine", "repair", "inspection"] as const).map((value) => ({
      value,
      label: t(`fleet.service.${value}`),
    })),
  ];
  return (
    <Select
      id={id}
      label={t("fleet.service.kind")}
      options={options}
      required
      value={draft.values["kind"] ?? ""}
      {...(draft.invalidFields?.["kind"] ? { error: t("errors.api.validation") } : {})}
      onBlur={() => {
        blur("kind");
      }}
      onChange={(event) => {
        change("kind", event.currentTarget.value);
      }}
    />
  );
}
function ServiceField({
  draft,
  field,
  change,
  blur,
}: FieldsProps & { field: (typeof fields)[number] }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <TextField
      id={id}
      label={t(field.label)}
      type={field.type}
      required={field.required}
      value={draft.values[field.name] ?? ""}
      error={draft.invalidFields?.[field.name] ? t("errors.api.validation") : undefined}
      min={field.type === "number" ? (field.name === "odometer_km" ? 0 : 1) : undefined}
      onBlur={() => {
        blur(field.name);
      }}
      onChange={(event) => {
        change(field.name, event.currentTarget.value);
      }}
    />
  );
}
function ServiceNotes({ draft, change, blur }: FieldsProps) {
  const { t } = useTranslation();
  const id = useId();
  const error = draft.invalidFields?.["notes"] ? t("errors.api.validation") : undefined;
  return (
    <div>
      <label htmlFor={id}>{t("fleet.history.notes")}</label>
      <textarea
        id={id}
        maxLength={1000}
        value={draft.values["notes"] ?? ""}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        onBlur={() => {
          blur("notes");
        }}
        onChange={(event) => {
          change("notes", event.currentTarget.value);
        }}
      />
      <FieldNotes id={id} error={error} />
    </div>
  );
}
