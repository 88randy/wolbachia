import { useTranslation } from "react-i18next";
import { FormAlert } from "../forms/FormAlert";
import { FormNotice } from "../forms/FormNotice";
import { SubmitButton } from "../forms/SubmitButton";
import formStyles from "../forms/form.module.css";
import { useFormatDate } from "../format/use-formatters";
import { outcomeKey } from "./create-version";
import { useParameterLabels } from "./parameter-labels";
import type { RuleParameter } from "./rules-query";
import styles from "./rules.module.css";
import { useIssueText } from "./use-issue-text";
import { useNewVersionForm } from "./use-new-version-form";
import { VersionComparison } from "./VersionComparison";
import { VersionDateField } from "./VersionDateField";
import { VersionReasonField } from "./VersionReasonField";
import { VersionValueField } from "./VersionValueField";

const ALERT_ID = "rule-version-alert";
const TITLE_ID = "rule-version-title";

/** Title, what saving does, and the change already scheduled (a second one would stack on it). */
function FormIntro({ parameter }: { parameter: RuleParameter }) {
  const { t } = useTranslation();
  const formatDate = useFormatDate();
  return (
    <>
      <h2 id={TITLE_ID} className={styles.cardTitle}>
        {t("rules.form.title")}
      </h2>
      <p className={styles.hint}>{t("rules.form.hint")}</p>
      {parameter.next_change_at !== null && (
        <p className={styles.hint}>
          {t("rules.form.scheduledNote", { date: formatDate(parameter.next_change_at) })}
        </p>
      )}
    </>
  );
}

/** What the last submit said: the refusal (an alert, focused) or that the version was saved. */
function FormFeedback({ state }: { state: ReturnType<typeof useNewVersionForm> }) {
  const { t } = useTranslation();
  const { refusal } = state;
  return (
    <>
      {refusal !== undefined && (
        <FormAlert
          id={ALERT_ID}
          ref={state.alertRef}
          title={t("rules.error.title")}
          text={t(outcomeKey(refusal))}
        />
      )}
      {state.isSaved && <FormNotice title={t("rules.form.saved")} />}
    </>
  );
}

/**
 * The "new version" form of one parameter (W62): value, effective date and reason, with the
 * before and after beside it. Saving adds a version; nothing is overwritten. The value is checked
 * against the parameter's limits as it is typed; the server's answer still decides.
 */
export function NewVersionForm({ parameter }: { parameter: RuleParameter }) {
  const { t } = useTranslation();
  const labels = useParameterLabels();
  const state = useNewVersionForm(parameter);
  const { form } = state;
  const fields = { form, errorText: useIssueText(parameter, state.serverBounds) };
  return (
    <section className={styles.card} aria-labelledby={TITLE_ID}>
      <FormIntro parameter={parameter} />
      <form className={formStyles.form} onSubmit={state.submit} noValidate>
        <div className={styles.formGrid}>
          <VersionValueField {...fields} unit={labels.unit(parameter.unit)} />
          <VersionDateField {...fields} />
        </div>
        <VersionReasonField {...fields} />
        <VersionComparison parameter={parameter} control={form.control} />
        <FormFeedback state={state} />
        <SubmitButton
          label={t("rules.form.submit")}
          busyLabel={t("rules.form.busy")}
          isBusy={state.isBusy}
        />
      </form>
    </section>
  );
}
