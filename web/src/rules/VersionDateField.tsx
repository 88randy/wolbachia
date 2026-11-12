import { useTranslation } from "react-i18next";
import { DateField } from "../ui/DateField";
import type { VersionFieldProps } from "./VersionValueField";

/** The day the version takes effect: a calendar date of the organization, not an instant. */
export function VersionDateField({ form, errorText }: VersionFieldProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <DateField
        id="rule-version-date"
        label={`${t("rules.form.effectiveFrom")} (${t("rules.form.required")})`}
        value={form.watch("effectiveFrom")}
        error={errorText(form.formState.errors.effectiveFrom)}
        onChange={(day) => {
          form.setValue("effectiveFrom", day, { shouldDirty: true, shouldValidate: true });
        }}
      />
      <p className="m-0 text-xs text-ink-2">{t("rules.form.effectiveHint")}</p>
    </div>
  );
}
