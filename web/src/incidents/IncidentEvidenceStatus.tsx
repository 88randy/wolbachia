import { useTranslation } from "react-i18next";
import type { useIncidentUpload } from "./use-incident-upload";
export function IncidentEvidenceStatus({
  upload,
}: {
  upload: ReturnType<typeof useIncidentUpload>;
}) {
  const { t } = useTranslation();
  return (
    <>
      {upload.proof && (
        <p>
          {upload.proof.file.name} ?{" "}
          {t(
            upload.proof.verifiedAt ? "incidents.evidence.verified" : "incidents.evidence.pending",
          )}
        </p>
      )}
      {upload.isInvalid && <p role="alert">{t("incidents.evidence.invalid")}</p>}
      {upload.hasFailed && <p role="alert">{t("incidents.evidence.failed")}</p>}
    </>
  );
}
