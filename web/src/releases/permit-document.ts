/** Rules of the permit official-document picker: PDF, JPEG and PNG only (field evidence stays images). */
export const PERMIT_DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type PermitDocumentType = (typeof PERMIT_DOCUMENT_TYPES)[number];
export const PERMIT_DOCUMENT_ACCEPT = PERMIT_DOCUMENT_TYPES.join(",");
/** Backend default and hard ceiling (`UPLOAD_MAX_BYTES`); settings may only lower it. */
export const PERMIT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export type PermitDocumentProblem = "invalidType" | "tooLarge" | "empty";

const UPLOAD_ERROR_KEYS: Record<string, string> = {
  upload_content_mismatch: "errors.upload.contentMismatch",
  upload_invalid_pdf: "errors.upload.invalidPdf",
  upload_pdf_encrypted: "errors.upload.pdfEncrypted",
  upload_type_not_allowed: "errors.upload.typeNotAllowed",
  upload_too_large: "errors.upload.tooLarge",
};

export function isPermitDocumentType(type: string): type is PermitDocumentType {
  return (PERMIT_DOCUMENT_TYPES as readonly string[]).includes(type);
}

/** Client-side check before any upload; the server re-validates type, bytes and size. */
export function permitDocumentProblem(
  file: Pick<File, "type" | "size">,
  maxBytes = PERMIT_DOCUMENT_MAX_BYTES,
): PermitDocumentProblem | undefined {
  if (!isPermitDocumentType(file.type)) return "invalidType";
  if (file.size <= 0) return "empty";
  if (file.size > maxBytes) return "tooLarge";
  return undefined;
}

/** i18n key of a backend upload error code, or undefined when the code is not an upload code. */
export function uploadErrorKey(code: string): string | undefined {
  return UPLOAD_ERROR_KEYS[code];
}

export function formatFileSize(bytes: number, locale: string): string {
  const mib = bytes / (1024 * 1024);
  if (mib >= 1)
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(mib)} MiB`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.max(1, bytes / 1024))} KiB`;
}
