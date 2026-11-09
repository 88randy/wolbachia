import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { FleetOperationProps } from "./FleetOperationForm";
import type { FleetDraft } from "./fleet-drafts";
import styles from "./fleet.module.css";
function EvidenceList({ draft }: { draft: FleetDraft }) {
  const { t } = useTranslation();
  return (
    <ul aria-live="polite">
      {draft.files.map((file) => (
        <li key={file.clientId}>
          {file.file.name} ·{" "}
          {t(file.verifiedAt ? "fleet.evidence.verified" : "fleet.evidence.pending")}
          {file.verifiedAt && <p>{file.uploadId}</p>}
        </li>
      ))}
    </ul>
  );
}
function EvidencePicker({ operations }: FleetOperationProps) {
  const { t } = useTranslation();
  return (
    <label>
      {t("fleet.evidence.files")}
      <input
        type="file"
        accept="image/jpeg,image/png"
        multiple
        onChange={(event) => {
          operations.select(Array.from(event.currentTarget.files ?? []));
        }}
      />
    </label>
  );
}
export function FleetFaultEvidence({ draft, operations }: FleetOperationProps) {
  const { t } = useTranslation();
  const disabled =
    draft.phase !== "idle" ||
    operations.isUnverified ||
    operations.cooling ||
    draft.failure === "uncertain";
  return (
    <fieldset disabled={disabled} className={styles.formFields}>
      <EvidencePicker draft={draft} operations={operations} />
      <p>{t("fleet.evidence.hint")}</p>
      <EvidenceList draft={draft} />
      {draft.evidenceInvalid && <p role="alert">{t("fleet.evidence.invalid")}</p>}
      {draft.evidenceFailed && <p role="alert">{t("fleet.evidence.failed")}</p>}
      <Button
        variant="secondary"
        aria-disabled={disabled || !draft.files.length || draft.evidenceInvalid}
        onClick={() => {
          void operations.upload();
        }}
      >
        {t("fleet.evidence.upload")}
      </Button>
    </fieldset>
  );
}
