import { useTranslation } from "react-i18next";
import type { useIncidentUpload } from "./use-incident-upload";
export function IncidentEvidenceInput({
  upload,
}: {
  upload: ReturnType<typeof useIncidentUpload>;
}) {
  const { t } = useTranslation();
  return (
    <>
      <label htmlFor="incident-evidence">{t("incidents.evidence.file")}</label>
      <input
        id="incident-evidence"
        type="file"
        accept="image/jpeg,image/png"
        onChange={(event) => {
          upload.select(event.target.files?.[0]);
        }}
      />
      <p>{t("incidents.evidence.hint")}</p>
    </>
  );
}
