import { useEffect, useId } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { useTransferUpload } from "./use-transfer-upload";
import type { TransferUploadScope } from "./use-transfer-upload";
import { TransferEvidenceFeedback } from "./TransferEvidenceFeedback";
import styles from "./transfers.module.css";

interface EvidenceProps {
  scope: TransferUploadScope;
  label: string;
  onVerified: (id: string) => void;
  isBlocked?: boolean;
}

/** A photo: it is saved as soon as it is chosen, with no extra "verify" step. */
export function TransferEvidence({ scope, label, onVerified, isBlocked = false }: EvidenceProps) {
  const { t } = useTranslation();
  const id = useId();
  const upload = useTransferUpload(scope, onVerified);
  const { proof, status, isInvalid } = upload;
  useEffect(() => {
    if (proof && !proof.verifiedAt && status === "idle" && !isInvalid) upload.verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once per chosen photo
  }, [proof, status, isInvalid]);
  if (!scope.identity.permissions?.includes("field.upload"))
    return <p>{t("transferEvidence.upload.noPermission")}</p>;
  return (
    <fieldset className={styles.proof} disabled={isBlocked || upload.isBusy}>
      <TextField
        id={id}
        label={label}
        type="file"
        accept="image/jpeg,image/png"
        onChange={upload.selectEvent}
      />
      <TransferEvidenceFeedback upload={upload} />
    </fieldset>
  );
}
