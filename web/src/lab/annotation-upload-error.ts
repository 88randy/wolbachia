import type { MessageKey } from "@wolbachia/i18n";
import { ApiError } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { formatFileSize } from "../releases/permit-document";
const UPLOAD_ERRORS: Record<string, MessageKey> = {
  upload_content_mismatch: "errors.upload.contentMismatch",
  upload_too_large: "errors.upload.tooLarge",
  upload_type_not_allowed: "labAnnotation.upload.invalid",
  permission_denied: "labAnnotation.upload.permission",
  invalid: "labAnnotation.upload.invalid",
  upload_pixel_limit: "labAnnotation.upload.pixelLimit",
  upload_invalid_image: "labAnnotation.upload.invalidImage",
  upload_animation_not_supported: "labAnnotation.upload.invalidImage",
  upload_type_mismatch: "labAnnotation.upload.invalidImage",
  upload_sanitized_too_large: "labAnnotation.upload.sanitizedTooLarge",
};
export function annotationUploadError(code: string): MessageKey {
  return UPLOAD_ERRORS[code] ?? "labAnnotation.upload.failed";
}

export function annotationUploadFailure(error: unknown): Schemas["FieldError"] {
  if (!(error instanceof ApiError)) return { code: "upload_failed", params: {} };
  const fields = error.envelope?.fields ?? {};
  return fields.file?.[0] ?? Object.values(fields).flat()[0] ?? { code: error.code, params: {} };
}

export function annotationUploadParams(failure: Schemas["FieldError"], language: string) {
  const limit = failure.params.max ?? failure.params.max_bytes;
  const max =
    failure.code === "upload_pixel_limit"
      ? new Intl.NumberFormat(language).format(typeof limit === "number" ? limit : 25_000_000)
      : formatFileSize(typeof limit === "number" ? limit : 10 * 1024 * 1024, language);
  return { ...failure.params, max };
}
