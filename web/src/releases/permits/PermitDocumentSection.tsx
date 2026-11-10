import { useTranslation } from "react-i18next";
import { PermitDocumentPicker } from "../PermitDocumentPicker";
import type { usePermitForm } from "./use-permit-form";

/** The official document: picked, uploaded and verified before the version can be saved. */
export function PermitDocumentSection({ form }: { form: ReturnType<typeof usePermitForm> }) {
  const { t } = useTranslation();
  const { document } = form;
  const missing = form.errors.document;
  return (
    <>
      <PermitDocumentPicker
        file={document.file}
        uploadError={document.error ?? (missing === undefined ? undefined : t(missing))}
        isBusy={document.isBusy}
        onSelect={document.select}
        onUpload={document.upload}
      />
      {document.uploadId !== undefined && <p role="status">{t("permits.form.documentUploaded")}</p>}
    </>
  );
}
