import { useTranslation } from "react-i18next";
import { formatFileSize, permitDocumentProblem } from "./permit-document";

/** Translated texts and blocking state of the picker for the selected file. */
export function usePermitDocumentView(
  file: File | undefined,
  maxBytes: number,
  uploadError: string | undefined,
) {
  const { t, i18n } = useTranslation();
  const max = formatFileSize(maxBytes, i18n.language);
  const problem = file ? permitDocumentProblem(file, maxBytes) : undefined;
  return {
    max,
    error: problem ? t(`permitDocument.file.${problem}`, { max }) : uploadError,
    isBlocked: !file || problem !== undefined,
    selected: file
      ? t("permitDocument.file.selected", {
          name: file.name,
          size: formatFileSize(file.size, i18n.language),
        })
      : undefined,
  };
}
