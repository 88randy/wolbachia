import { useId } from "react";
import { useTranslation } from "react-i18next";
import { FileField } from "../forms/FileField";
import { PERMIT_DOCUMENT_ACCEPT } from "./permit-document";
import type { usePermitDocumentView } from "./use-permit-document-view";

interface Props {
  view: ReturnType<typeof usePermitDocumentView>;
  isBusy: boolean;
  file?: File | undefined;
  onSelect: (file: File | undefined) => void;
}

/** File input restricted to PDF, JPEG and PNG, with the size limit as hint. */
export function PermitDocumentField({ view, isBusy, file, onSelect }: Props) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <FileField
      id={id}
      file={file}
      label={t("permitDocument.file.label")}
      hint={t("permitDocument.file.hint", { max: view.max })}
      accept={PERMIT_DOCUMENT_ACCEPT}
      error={view.error}
      disabled={isBusy}
      onChange={(event) => {
        onSelect(event.currentTarget.files?.[0]);
      }}
    />
  );
}
