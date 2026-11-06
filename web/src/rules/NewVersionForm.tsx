import { useTranslation } from "react-i18next";
import { SubmitButton } from "../forms/SubmitButton";
import formStyles from "../forms/form.module.css";
import { Card } from "../ui/Card";
import { useParameterLabels } from "./parameter-labels";
import type { RuleParameter } from "./rules-query";
import styles from "./rules.module.css";
import { useIssueText } from "./use-issue-text";
import { useNewVersionForm } from "./use-new-version-form";
import { VersionComparison } from "./VersionComparison";
import { VersionDateField } from "./VersionDateField";
import { VersionReasonField } from "./VersionReasonField";
import { VersionValueField } from "./VersionValueField";
import { NewVersionIntro } from "./NewVersionIntro";
import { NewVersionFeedback } from "./NewVersionFeedback";
/** Adding a version retains the existing validation, draft and server-confirmed write path. */
export function NewVersionForm({ parameter }: { parameter: RuleParameter }) {
  const { t } = useTranslation();
  const labels = useParameterLabels();
  const state = useNewVersionForm(parameter);
  const { form } = state;
  const fields = { form, errorText: useIssueText(parameter, state.serverBounds) };
  return (
    <Card title={t("rules.form.title")} titleId="rule-version-title">
      <NewVersionIntro parameter={parameter} />
      <form className={formStyles.form} onSubmit={state.submit} noValidate>
        <div className={styles.formGrid}>
          <VersionValueField {...fields} unit={labels.unit(parameter.unit)} />
          <VersionDateField {...fields} />
        </div>
        <VersionReasonField {...fields} />
        <VersionComparison parameter={parameter} control={form.control} />
        <NewVersionFeedback state={state} />
        <SubmitButton
          label={t("rules.form.submit")}
          busyLabel={t("rules.form.busy")}
          isBusy={state.isBusy}
        />
      </form>
    </Card>
  );
}
