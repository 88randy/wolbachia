import { useEffect, useRef } from "react";
import { CountFeedback } from "./CountFeedback";
import { CorrectionCountFields } from "./CorrectionCountFields";
import { CorrectionFormActions } from "./CorrectionFormActions";
import { useCorrectionForm } from "./use-correction-form";
import type { CorrectionOptions } from "./use-correction-form";
import styles from "./lab.module.css";
export function CorrectionForm(props: CorrectionOptions & { onCancel: () => void }) {
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
      <CorrectionCountFields form={form} count={props.count} />
      <CountFeedback failure={form.write.failure} scope={props.scope} />
      <CorrectionFormActions form={form} onCancel={props.onCancel} />
    </form>
  );
}
