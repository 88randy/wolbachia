import { useTranslation } from "react-i18next";
import type { useTransferUpload } from "./use-transfer-upload";
export function TransferEvidenceFeedback({
  upload,
}: {
  upload: ReturnType<typeof useTransferUpload>;
}) {
  const { t } = useTranslation();
  return (
    <div aria-live="polite">
      <p>{t("transferEvidence.upload.hint")}</p>
      {upload.proof && (
        <p>
          {t(
            upload.proof.verifiedAt
              ? "transferEvidence.upload.verified"
              : "transferEvidence.upload.pending",
          )}
        </p>
      )}
      {upload.isInvalid && <p role="alert">{t("transferEvidence.upload.invalid")}</p>}
      {upload.status === "failed" && <p role="alert">{t("transferEvidence.upload.failed")}</p>}
    </div>
  );
}
