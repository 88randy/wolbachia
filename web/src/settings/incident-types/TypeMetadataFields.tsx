import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { TypeSeverityField } from "./TypeSeverityField";
import type { TypeFieldProps } from "./type-editor-types";
import { TYPE_CODE_MAX_LENGTH } from "./type-limits";
const FIELDS = ["code", "label", "icon"] as const;
const LABELS = {
  code: "incidentTypes.field.code",
  label: "incidentTypes.field.label",
  icon: "incidentTypes.field.icon",
} as const;
export function TypeMetadataFields(props: TypeFieldProps) {
  const { t } = useTranslation();
  return (
    <>
      {FIELDS.map((name) => (
        <TextField
          key={name}
          id={`type-${name}`}
          label={t(LABELS[name])}
          value={props.draft[name] ?? ""}
          required={name !== "icon"}
          disabled={name === "code" ? Boolean(props.item) : props.item?.is_other}
          maxLength={name === "code" ? TYPE_CODE_MAX_LENGTH : name === "label" ? 200 : 64}
          pattern={
            name === "code" ? "[a-z0-9][a-z0-9_-]*" : name === "icon" ? "[a-z0-9-]*" : undefined
          }
          error={props.fields?.[name] ? t("incidentTypes.error.field") : undefined}
          onChange={(event) => {
            props.change(name, event.target.value);
          }}
        />
      ))}
      <TypeSeverityField {...props} />
    </>
  );
}
