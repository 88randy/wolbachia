import { useTranslation } from "react-i18next";
import { FieldNotes } from "../forms/FieldNotes";
import formStyles from "../forms/form.module.css";
import styles from "./rules.module.css";
import type { VersionFieldProps } from "./VersionValueField";

const ID = "rule-version-reason";

/** Why the value changes: kept with the version, so whoever reads the history knows. */
export function VersionReasonField({ form, errorText }: VersionFieldProps) {
  const { t } = useTranslation();
  const error = errorText(form.formState.errors.reason);
  return (
    <div className={formStyles.field}>
      <label htmlFor={ID} className={formStyles.label}>
        {t("rules.form.reason")}{" "}
        <span className={styles.required}>({t("rules.form.required")})</span>
      </label>
      <textarea
        id={ID}
        className={styles.textarea}
        rows={3}
        aria-required="true"
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={error === undefined ? undefined : `${ID}-error`}
        {...form.register("reason")}
      />
      <FieldNotes id={ID} error={error} />
    </div>
  );
}
