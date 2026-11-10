import { useEffect, useId } from "react";
import { useTranslation } from "react-i18next";
import { TextField } from "../../forms/TextField";
import { useCertificateUpload } from "./use-certificate-upload";
import type { TrainingScope } from "./training-query";
import { CertificateEvidenceActions } from "./CertificateEvidenceActions";
interface Props {
  scope: TrainingScope;
  onVerified: (id: string) => void;
  isBlocked: boolean;
  onBusyChange: (busy: boolean) => void;
}
export function CertificateEvidencePicker({ scope, onVerified, isBlocked, onBusyChange }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const upload = useCertificateUpload(scope, onVerified);
  const isBusy = upload.state === "busy";
  useEffect(() => {
    onBusyChange(isBusy);
  }, [isBusy, onBusyChange]);
  return (
    <div>
      <TextField
        id={id}
        type="file"
        label={t("trainings.evidence.file")}
        hint={t("trainings.evidence.hint")}
        accept="image/png,image/jpeg"
        onChange={(event) => {
          upload.select(event.currentTarget.files?.[0]);
        }}
        disabled={isBusy || isBlocked}
      />
      <CertificateEvidenceActions upload={upload} isBlocked={isBlocked} />
    </div>
  );
}
