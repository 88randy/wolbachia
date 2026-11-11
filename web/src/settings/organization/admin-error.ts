import { InvalidLogoError } from "./branding";
import { ApiError } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { tableErrorKey } from "../../data-table/table-error";
const USER_FIELD_KEYS: Readonly<Record<string, MessageKey>> = {
  own_account: "users.error.ownAccount",
  shared_account: "users.error.sharedAccount",
  inactive: "users.error.inactive",
};

/** 400 on the temporary-password action: the problem sits in the `user` field. */
function userFieldKey(error: ApiError): MessageKey | undefined {
  return USER_FIELD_KEYS[error.envelope?.fields?.["user"]?.[0]?.code ?? ""];
}

export function adminErrorKey(error: unknown): MessageKey {
  if (error instanceof InvalidLogoError) return "orgAdmin.brand.invalid";
  if (!(error instanceof ApiError)) return tableErrorKey(error);
  if (error.code === "last_administrator") return "orgAdmin.error.lastAdministrator";
  if (error.code === "own_administration") return "users.error.ownAdministration";
  if (error.code === "stale_revision") return "orgAdmin.error.staleRevision";
  if (error.code === "government_portal_only") return "orgAdmin.error.readOnly";
  const userKey = userFieldKey(error);
  if (userKey) return userKey;
  if (error.status === 400) return "orgAdmin.error.validation";
  return tableErrorKey(error);
}
