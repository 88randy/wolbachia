import { useId } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { Button } from "../../ui/Button";
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
export function TransferEvidence({ scope, label, onVerified, isBlocked = false }: EvidenceProps) {
  const { t } = useTranslation();
  const id = useId();
  const upload = useTransferUpload(scope, onVerified);
  if (!scope.identity.permissions?.includes("field.upload"))
    return <p>{t("transferEvidence.upload.noPermission")}</p>;
  const isDisabled =
    isBlocked || !upload.proof || upload.isInvalid || Boolean(upload.proof.verifiedAt);
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
      <Button aria-disabled={isDisabled} loading={upload.isBusy} onClick={upload.verify}>
        {t("transferEvidence.upload.verify")}
      </Button>
    </fieldset>
  );
}
