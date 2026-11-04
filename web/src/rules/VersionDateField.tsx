import { useTranslation } from "react-i18next";
import { TextField } from "../forms/TextField";
import type { VersionFieldProps } from "./VersionValueField";

/** The day the version takes effect: a calendar date of the organization, not an instant. */
export function VersionDateField({ form, errorText }: VersionFieldProps) {
  const { t } = useTranslation();
  return (
    <TextField
      id="rule-version-date"
      type="date"
      label={`${t("rules.form.effectiveFrom")} (${t("rules.form.required")})`}
      hint={t("rules.form.effectiveHint")}
      error={errorText(form.formState.errors.effectiveFrom)}
      aria-required="true"
      {...form.register("effectiveFrom")}
    />
  );
}
