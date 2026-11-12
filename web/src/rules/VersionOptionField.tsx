import { useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Select } from "../forms/Select";
import { optionKindOf, useParameterLabels } from "./parameter-labels";
import { VersionSwitchField } from "./VersionSwitchField";
import type { VersionFieldProps } from "./VersionValueField";

/**
 * The new value of an option parameter: a switch for a yes/no one, a select for the rest. The form
 * still holds the number the API takes ("0", "1", "2").
 */
export function VersionOptionField({
  form,
  errorText,
  parameterKey,
}: VersionFieldProps & { parameterKey: string }) {
  const { t } = useTranslation();
  const options = useParameterLabels().options(parameterKey) ?? [];
  const value = useWatch({ control: form.control, name: "value" });
  const label = `${t("rules.form.value")} (${t("rules.form.required")})`;
  if (optionKindOf(parameterKey) === "boolean") {
    const chosen = options.find((option) => option.value === value)?.label ?? "";
    return <VersionSwitchField form={form} value={value} label={`${label}: ${chosen}`} />;
  }
  return (
    <Select
      id="rule-version-value"
      label={label}
      options={options}
      value={value}
      error={errorText(form.formState.errors.value)}
      onChange={(event) => {
        form.setValue("value", event.target.value, { shouldDirty: true, shouldValidate: true });
      }}
    />
  );
}
