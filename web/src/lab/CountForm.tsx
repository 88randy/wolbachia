import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Schemas } from "@wolbachia/api-client";
import { Link } from "@tanstack/react-router";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useCan } from "../session/use-can";
import { CountInput } from "./CountInput";
import { CountFeedback } from "./CountFeedback";
import { useCountForm } from "./use-count-form";
import type { Candidate, LabScope } from "./lab-query";
import { CountFormActions } from "./CountFormActions";
import styles from "./lab.module.css";
interface CountFormProps {
  bag: Candidate; scope: LabScope; storageKey: string;
  context: Schemas["LabQueueQueryRequest"];
  onLockChange: (locked: boolean) => void;
  onSaved: (outcome: Schemas["LabCountOutcome"]) => void;
}
export function CountForm(props: CountFormProps) {
  const { t } = useTranslation();
  const form = useCountForm(props);
  const canRead = useCan()("egg_count.read");
  const onLockChange = props.onLockChange;
  useEffect(() => { onLockChange(form.write.isBusy || form.write.failure?.kind === "uncertain"); }, [onLockChange, form.write.isBusy, form.write.failure]);
  const isLocked = form.write.isBusy || form.write.failure?.kind === "uncertain" || form.write.failure?.kind === "conflict";
  return (
    <Card title={props.bag.code}>
      <form className={styles.form} noValidate onSubmit={(event) => { event.preventDefault(); void form.submit(); }}>
        {form.isRestored && <p>{t("lab.draft.restored")} <Button variant="ghost" aria-disabled={isLocked} onClick={form.discard}>{t("lab.draft.discard")}</Button></p>}
        <CountInput onBlur={form.validate} value={form.value} onChange={form.change} inputRef={form.input} isInvalid={form.isInvalid} isReadOnly={isLocked || form.write.failure?.kind === "conflict"} />
        <CountFeedback failure={form.write.failure} scope={props.scope} code={props.bag.code} />
        <CountFormActions form={form} />
      </form>
      {canRead && <Link to="/lab/count-history" search={{ code: props.bag.code }}>{t("lab.history.link")}</Link>}
    </Card>
  );
}
