import { useTranslation } from "react-i18next";
import { Select } from "../../forms/Select";
import { isConfiguredType } from "./incident-types-query";
import type { TypeFieldProps } from "./type-editor-types";
const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export function TypeSeverityField({ draft, change, item }: TypeFieldProps) {
  const { t } = useTranslation();
  const severities =
    (item?.code ?? draft.code) === "emergency-accident" ? ["critical" as const] : SEVERITIES;
  return (
    <Select
      id="type-severity"
      label={t("incidentTypes.field.severity")}
      value={draft.severity}
      disabled={item?.code === "emergency-accident" && isConfiguredType(item)}
      required
      options={[
        { value: "", label: t("incidentTypes.form.chooseSeverity") },
        ...severities.map((value) => ({ value, label: t(`incidents.severity.${value}`) })),
      ]}
      onChange={(event) => {
        const value = SEVERITIES.find((severity) => severity === event.target.value);
        if (value) change("severity", value);
      }}
    />
  );
}
