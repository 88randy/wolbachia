import { ApiError, isErrorEnvelope } from "@wolbachia/api-client";
import type { ErrorEnvelope } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import type { QueryClient } from "@tanstack/react-query";
import { reportSessionError } from "../session/session-events";
type FieldIssues = Partial<Record<"code" | "label_es" | "label_en", MessageKey>>;
export type CatalogOutcome =
  { kind: "saved" } | { kind: "stale" } | { kind: "failed"; key: MessageKey; fields: FieldIssues };
const CODE_KEYS: Readonly<Record<string, MessageKey>> = {
  catalog_version_conflict: "catalogs.error.versionConflict",
  duplicate_code: "catalogs.error.duplicate",
  reserved_code: "catalogs.error.reserved",
  sort_exhausted: "catalogs.error.sort",
  catalog_item_limit_reached: "catalogs.error.limit",
  other_item_cannot_be_deactivated: "catalogs.error.other",
  other_item_protected: "catalogs.error.other",
};
interface Answer {
  response: Response;
  error?: unknown;
}
function fieldIssuesOf(envelope: ErrorEnvelope | undefined): FieldIssues {
  const fields: FieldIssues = {};
  for (const name of ["code", "label_es", "label_en"] as const) {
    const first = envelope?.fields?.[name]?.[0];
    if (first) fields[name] = CODE_KEYS[first.code] ?? "errors.api.validation";
  }
  return fields;
}
function messageOf(status: number, envelope: ErrorEnvelope | undefined): MessageKey {
  const sortCode = envelope?.fields?.sort?.[0]?.code;
  const key = CODE_KEYS[envelope?.code ?? ""] ?? CODE_KEYS[sortCode ?? ""];
  if (key) return key;
  return httpMessageOf(status);
}
function httpMessageOf(status: number): MessageKey {
  if (status === 400) return "errors.api.validation";
  if (status === 403) return "errors.api.permissionDenied";
  if (status === 404) return "errors.api.notFound";
  return "errors.api.generic";
}
/** Server detail is never shown, including unknown validation errors. */
export function catalogFailure(status: number, error: unknown): CatalogOutcome {
  const envelope = isErrorEnvelope(error) ? error : undefined;
  return { kind: "failed", key: messageOf(status, envelope), fields: fieldIssuesOf(envelope) };
}
/** Compare the submit revision before reporting errors or changing forms/cache. */
export async function sendCatalogWrite(
  queryClient: QueryClient,
  call: () => Promise<Answer>,
  isStale: () => boolean,
): Promise<CatalogOutcome> {
  try {
    const { response, error } = await call();
    if (isStale()) return { kind: "stale" };
    if (response.ok) return { kind: "saved" };
    reportSessionError(
      new ApiError(response.status, isErrorEnvelope(error) ? error : undefined),
      queryClient,
    );
    return catalogFailure(response.status, error);
  } catch (caught) {
    if (isStale()) return { kind: "stale" };
    console.error("Catalog request failed", caught);
    return { kind: "failed", key: "errors.api.network", fields: {} };
  }
}
