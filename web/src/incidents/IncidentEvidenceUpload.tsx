import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { useIncidentUpload } from "./use-incident-upload";
interface UploadProps {
  upload: ReturnType<typeof useIncidentUpload>;
  isBlocked: boolean;
}
export function IncidentEvidenceUpload({ upload, isBlocked }: UploadProps) {
  const { t } = useTranslation();
  const isDisabled =
    isBlocked || !upload.proof || upload.isInvalid || Boolean(upload.proof.verifiedAt);
  return (
    <Button
      aria-disabled={isDisabled}
      loading={upload.isBusy}
      onClick={() => {
        void upload.upload();
      }}
    >
      {t("incidents.evidence.upload")}
    </Button>
  );
}
