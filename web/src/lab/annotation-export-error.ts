import { ApiError } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";

export interface ExportFailure {
  key: MessageKey;
  field?: "date_from" | "date_to";
  params: Record<string, string | number>;
}

const EXPORT_ERRORS: Record<string, MessageKey> = {
  annotation_export_too_many_images: "annotationExport.error.tooMany",
  annotation_export_too_many_bytes: "annotationExport.error.tooLarge",
  annotation_export_date_range: "annotationExport.error.tooLong",
  annotation_export_in_progress: "annotationExport.error.inProgress",
};
const LIMIT_PARAMS: Record<string, string> = {
  max_days: "maxDays",
  max_images: "maxImages",
  max_bytes: "maxBytes",
};

function formatLimits(params: Record<string, unknown>, language: string) {
  return Object.fromEntries(
    Object.entries(params).flatMap(([name, value]) =>
      typeof value === "number" && LIMIT_PARAMS[name]
        ? [[LIMIT_PARAMS[name], new Intl.NumberFormat(language).format(value)]]
        : [],
    ),
  );
}

function firstExportError(error: ApiError) {
  const [field, errors] = Object.entries(error.envelope?.fields ?? {})[0] ?? [];
  return { field, failure: errors?.[0] ?? { code: error.code, params: {} } };
}

/** API field errors preserve the server's limits and the field the user can change. */
export function exportFailure(error: unknown, language: string): ExportFailure {
  if (!(error instanceof ApiError)) return { key: "annotationExport.error.failed", params: {} };
  const { field, failure } = firstExportError(error);
  return {
    key: EXPORT_ERRORS[failure.code] ?? "annotationExport.error.failed",
    ...(field === "date_from" || field === "date_to" ? { field } : {}),
    params: formatLimits(failure.params, language),
  };
}
