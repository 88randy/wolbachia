import { useEffect } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { Card } from "../ui/Card";
import { CountFormFields } from "./CountFormFields";
import { CountHistoryLink } from "./CountHistoryLink";
import { useCountForm } from "./use-count-form";
import type { Candidate, LabScope } from "./lab-query";
import styles from "./lab.module.css";
interface CountFormProps {
  bag: Candidate;
  scope: LabScope;
  storageKey: string;
  context: Schemas["LabQueueQueryRequest"];
  onLockChange: (locked: boolean) => void;
  onSaved: (outcome: Schemas["LabCountOutcome"]) => void;
}
export function CountForm(props: CountFormProps) {
  const form = useCountForm(props);
  const onLockChange = props.onLockChange;
  useEffect(() => {
    onLockChange(form.write.isBusy || form.write.failure?.kind === "uncertain");
  }, [onLockChange, form.write.isBusy, form.write.failure]);
  return (
    <Card title={props.bag.code}>
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.submit();
        }}
      >
        <CountFormFields
          form={form}
          scope={props.scope}
          code={props.bag.code}
          isLocked={form.isLocked}
        />
      </form>
      <CountHistoryLink code={props.bag.code} />
    </Card>
  );
}
