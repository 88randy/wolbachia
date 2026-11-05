import type { FieldError, UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { TextField } from "../forms/TextField";
import styles from "./rules.module.css";
import type { VersionValues } from "./version-schema";

export interface VersionFieldProps {
  form: UseFormReturn<VersionValues>;
  errorText: (error: FieldError | undefined) => string | undefined;
}

/** The new value, with the unit after it. Typed as text so the form, not the browser, parses it. */
export function VersionValueField({ form, errorText, unit }: VersionFieldProps & { unit: string }) {
  const { t } = useTranslation();
  return (
    <TextField
      id="rule-version-value"
      label={`${t("rules.form.value")} (${t("rules.form.required")})`}
      hint={t("rules.form.valueHint")}
      error={errorText(form.formState.errors.value)}
      trailing={<span className={styles.unit}>{unit}</span>}
      inputMode="decimal"
      autoComplete="off"
      aria-required="true"
      {...form.register("value")}
    />
  );
}
