import { ApiError, unwrap } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import type { TypeScope, TypeTarget } from "./incident-types-query";
import type { SessionGuard } from "../../session/use-session-guard";
import type { TypeDraft } from "./type-draft";
import { createTypeBody, writeBody } from "./type-draft";
import { tableErrorKey } from "../../data-table/table-error";
export async function saveType(request: {
  scope: TypeScope;
  draft: TypeDraft;
  item?: TypeTarget;
  guard: SessionGuard;
}) {
  const { scope, draft, item, guard } = request;
  const body = writeBody(draft, item);
  return item
    ? unwrap(
        await scope.client.PATCH("/api/v1/incident-types/{id}/", {
          params: { path: { id: item.id } },
          body,
          signal: guard.signal,
        }),
      )
    : unwrap(
        await scope.client.POST("/api/v1/incident-types/", {
          body: createTypeBody(draft),
          signal: guard.signal,
        }),
      );
}
export function typeErrorKey(error: unknown): MessageKey {
  if (!(error instanceof ApiError)) return tableErrorKey(error);
  if (error.status === 409) return "incidentTypes.error.conflict";
  if (error.code === "incident_configuration_unavailable") return "incidentTypes.error.terminal";
  return error.status === 400 ? "incidentTypes.error.validation" : tableErrorKey(error);
}
