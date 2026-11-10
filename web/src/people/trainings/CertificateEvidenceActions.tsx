import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { CertificateEvidenceStatus } from "./CertificateEvidenceStatus";
import type { useCertificateUpload } from "./use-certificate-upload";
interface Props {
  upload: ReturnType<typeof useCertificateUpload>;
  isBlocked: boolean;
}
export function CertificateEvidenceActions({ upload, isBlocked }: Props) {
  const { t } = useTranslation();
  return (
    <>
      <Button
        variant="secondary"
        aria-disabled={
          isBlocked || !upload.proof || upload.isInvalid || Boolean(upload.proof.verifiedAt)
        }
        loading={upload.state === "busy"}
        onClick={() => {
          void upload.upload();
        }}
      >
        {t("trainings.evidence.upload")}
      </Button>
      <CertificateEvidenceStatus upload={upload} />
    </>
  );
}
