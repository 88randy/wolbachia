import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CountFeedback } from "./CountFeedback";
import { CorrectionFields } from "./CorrectionFields";
import { CorrectionFormActions } from "./CorrectionFormActions";
import { useCorrectionForm } from "./use-correction-form";
import type { CorrectionOptions } from "./use-correction-form";
import styles from "./lab.module.css";
export function CorrectionForm(props: CorrectionOptions & { onCancel: () => void }) {
  const { t } = useTranslation();
  const form = useCorrectionForm(props);
  const element = useRef<HTMLFormElement>(null);
  useEffect(() => {
    element.current?.querySelector<HTMLButtonElement>("[data-lab-cancel]")?.focus();
  }, []);
  const kind = form.write.failure?.kind;
  const onBusyChange = props.onBusyChange;
  useEffect(() => {
    onBusyChange(form.write.isBusy || kind === "uncertain");
  }, [onBusyChange, form.write.isBusy, kind]);
  return (
    <form
      ref={element}
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.submit(kind === "confirm");
      }}
    >
      <CorrectionFields form={form} />
      <div role="alert">{form.hasReasonError && t("lab.correction.noteHint")}</div>
      <CountFeedback failure={form.write.failure} scope={props.scope} />
      <CorrectionFormActions form={form} onCancel={props.onCancel} />
    </form>
  );
}
