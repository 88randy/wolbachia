import { useTranslation } from "react-i18next";
import { FormAlert } from "../forms/FormAlert";
import { FormNotice } from "../forms/FormNotice";
import { outcomeKey } from "./create-version";
import type { useNewVersionForm } from "./use-new-version-form";
const ALERT_ID = "rule-version-alert";
export function NewVersionFeedback({ state }: { state: ReturnType<typeof useNewVersionForm> }) {
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
