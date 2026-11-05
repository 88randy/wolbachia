import { InvalidLogoError } from "./branding";
import { ApiError } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { tableErrorKey } from "../../data-table/table-error";
export function adminErrorKey(error: unknown): MessageKey {
  if (error instanceof InvalidLogoError) return "orgAdmin.brand.invalid";
  if (!(error instanceof ApiError)) return tableErrorKey(error);
  if (error.code === "last_administrator") return "orgAdmin.error.lastAdministrator";
  if (error.code === "stale_revision") return "orgAdmin.error.staleRevision";
  if (error.code === "government_portal_only") return "orgAdmin.error.readOnly";
  if (error.status === 400) return "orgAdmin.error.validation";
  return tableErrorKey(error);
}
