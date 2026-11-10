import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import type { useCertificateUpload } from "./use-certificate-upload";
export function CertificateEvidenceStatus({
  upload,
}: {
  upload: ReturnType<typeof useCertificateUpload>;
}) {
  const { t } = useTranslation();
  return (
    <div aria-live="polite">
      {upload.isInvalid && (
        <InlineNotice tone="warning">{t("trainings.evidence.invalid")}</InlineNotice>
      )}
      {upload.state === "failed" && (
        <InlineNotice tone="critical">{t("trainings.evidence.failed")}</InlineNotice>
      )}
      {upload.proof?.verifiedAt && (
        <InlineNotice tone="success">{t("trainings.evidence.verified")}</InlineNotice>
      )}
    </div>
  );
}
