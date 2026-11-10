import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { Button } from "../../ui/Button";
import { CommandFeedback } from "./CommandFeedback";
import { ReasonFields } from "./ReasonFields";
import { RpbiEvidence } from "./RpbiEvidence";
import { WriteOffTargetFields } from "./WriteOffTargetFields";
import type { WriteOffForm as Form } from "./use-write-off-form";
import type { AllocationScope } from "./allocation-query";
import styles from "../inventory.module.css";

function SubmitRow({ form, onClose }: { form: Form; onClose: () => void }) {
  const { t } = useTranslation();
  const id = useId();
  const isBlocked = form.blockers.length > 0;
  return (
    <>
      {isBlocked && (
        <ul id={id}>
          {form.blockers.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        <Button
          type="submit"
          loading={form.command.isBusy}
          aria-disabled={isBlocked || undefined}
          aria-describedby={isBlocked ? id : undefined}
        >
          {t("allocation.writeOff.submit")}
        </Button>
        <Button variant="tertiary" onClick={onClose}>
          {t("allocation.command.close")}
        </Button>
      </div>
    </>
  );
}

function DateField({ form }: { form: Form }) {
  const { t } = useTranslation();
  return (
    <TextField
      id="write-off-date"
      label={t("allocation.writeOff.fieldDate")}
      type="date"
      required
      value={form.date}
      onChange={(event) => {
        form.setDate(event.target.value);
      }}
    />
  );
}

/**
 * The one write-off form of W17 and W39. A biological Lot or any Bag cannot be submitted until a
 * server-verified RPBI handling receipt exists; the disabled submit names what is missing.
 */
export function WriteOffForm(props: { scope: AllocationScope; form: Form; onClose: () => void }) {
  const { t } = useTranslation();
  const { scope, form } = props;
  return (
    <form
      className={styles.form}
      aria-label={t("allocation.writeOff.formTitle")}
      onSubmit={(event) => {
        event.preventDefault();
        form.submit();
      }}
    >
      <WriteOffTargetFields form={form} />
      <ReasonFields fields={form.reason} />
      <DateField form={form} />
      {form.isBiological && (
        <RpbiEvidence
          scope={scope}
          rpbiUploadId={form.rpbiUploadId}
          onVerified={form.setRpbiUploadId}
        />
      )}
      <SubmitRow form={form} onClose={props.onClose} />
      <CommandFeedback command={form.command} successKey="allocation.writeOff.recorded" />
    </form>
  );
}
