import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import type { TypeFieldProps } from "./type-editor-types";
const FIELDS = [
  {
    name: "supervisor_sla_seconds",
    key: "incidentTypes.field.supervisorSla",
    min: 1,
    max: 2147483647,
  },
  {
    name: "coordinator_sla_seconds",
    key: "incidentTypes.field.coordinatorSla",
    min: 1,
    max: 2147483647,
  },
  { name: "report_evidence_min", key: "incidentTypes.field.reportEvidence", min: 0, max: 100 },
  { name: "close_evidence_min", key: "incidentTypes.field.closeEvidence", min: 1, max: 100 },
] as const;
export function TypeNumberFields({ draft, change, fields }: TypeFieldProps) {
  const { t } = useTranslation();
  return (
    <>
      {FIELDS.map(({ name, key, min, max }) => (
        <TextField
          key={name}
          id={`type-${name}`}
          label={t(key)}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          required
          value={draft[name]}
          error={fields?.[name] ? t("incidentTypes.error.field") : undefined}
          onChange={(event) => {
            change(name, event.target.value);
          }}
        />
      ))}
    </>
  );
}
