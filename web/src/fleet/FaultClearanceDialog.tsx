import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FieldNotes } from "../forms/FieldNotes";
import { useFleetDialog } from "./use-fleet-dialog";
import { FleetFaultEvidence } from "./FleetFaultEvidence";
import { FleetOperationForm, fleetInputsBlocked } from "./FleetOperationForm";
import type { FleetOperationProps } from "./FleetOperationForm";
import dialogStyles from "../void/void-dialog.module.css";
import styles from "./fleet.module.css";
function ReasonNotes({ id, draft, operations }: FleetOperationProps & { id: string }) {
  const { t } = useTranslation();
  return (
    <FieldNotes
      id={id}
      error={draft.invalidFields?.["reason"] ? t("errors.api.validation") : undefined}
      hint={t("fleet.clear.reasonLimits", {
        min: operations.limits.minLength,
        max: operations.limits.maxLength,
      })}
    />
  );
}
function ClearanceReason({ draft, operations }: FleetOperationProps) {
  const { t } = useTranslation();
  const id = useId();
  const field = { id, draft, operations };
  return (
    <div className={styles.formFields}>
      <label htmlFor={id}>{t("fleet.clear.reason")}</label>
      <textarea
        id={id}
        required
        maxLength={operations.limits.maxLength}
        disabled={fleetInputsBlocked(field)}
        value={draft.values["reason"] ?? ""}
        aria-invalid={draft.invalidFields?.["reason"] || undefined}
        aria-describedby={draft.invalidFields?.["reason"] ? `${id}-hint ${id}-error` : `${id}-hint`}
        onBlur={() => {
          operations.blur("reason");
        }}
        onChange={(event) => {
          operations.change("reason", event.currentTarget.value);
        }}
      />
      <ReasonNotes {...field} />
    </div>
  );
}
export function FaultClearanceDialog({ draft, operations }: FleetOperationProps) {
  const { t } = useTranslation();
  const title = useId();
  const modal = useFleetDialog(
    draft.phase !== "idle",
    operations.close,
    `fleet-record-refresh-${draft.motorcycle}`,
  );
  const verified =
    draft.files.length > 0 && draft.files.every((file) => !!file.verifiedAt && !!file.uploadId);
  return (
    <dialog {...modal} className={dialogStyles.dialog} aria-labelledby={title}>
      <h2 id={title}>{t("fleet.clear.title", { record: draft.motorcycle })}</h2>
      <p>{t("fleet.clear.hint")}</p>
      <p>
        {t("fleet.clear.fault")}: {draft.fault?.id}
      </p>
      <p>
        {t("fleet.clear.revision")}: {draft.revision}
      </p>
      <FleetOperationForm draft={draft} operations={operations} verified={verified}>
        <ClearanceReason draft={draft} operations={operations} />
        <FleetFaultEvidence draft={draft} operations={operations} />
      </FleetOperationForm>
    </dialog>
  );
}
