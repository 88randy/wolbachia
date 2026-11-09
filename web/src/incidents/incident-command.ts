import type { VoidLimits } from "../void/void-limits";
import { normalizeReason, countCharacters, hasForbiddenCharacters } from "../void/count-characters";
import { ApiError, unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import type { Incident } from "./incidents-query";
export type IncidentCommand =
 | { action: "comment"; body: Schemas["CommentRequest"] }
 | { action: "reassign"; body: Schemas["ReassignRequest"] }
 | { action: "change_severity"; body: Schemas["SeverityRequest"] }
 | { action: "close"; body: Schemas["CloseRequest"] }
 | { action: "void"; body: Schemas["IncidentVoidRequest"] };
/** Only distinct, currently readable verified evidence can authorize a close. */
export function verifiedIncidentEvidence(incident: Incident, uploaded: readonly string[] = []) {
 return [...new Set([...incident.evidence.filter(proof => proof.is_readable && proof.is_verified && proof.verified_at).map(proof => proof.id), ...uploaded])];
}
export function canCloseIncident(incident: Incident, ids: readonly string[], capture: { reason: string; limits: VoidLimits }) {
 const rules = incident.action_prerequisites;
 const reason = normalizeReason(capture.reason);
 return Boolean(incident.action_permissions.close && rules?.is_open && rules.can_upload_evidence && isIncidentReasonValid(reason, capture.limits) && new Set(ids).size >= rules.close_evidence_min);
}
export function isIncidentReasonValid(reason: string, limits: VoidLimits) {
 const normalized = normalizeReason(reason);
 return countCharacters(normalized) >= limits.minLength && Array.from(normalized).length <= limits.maxLength && !hasForbiddenCharacters(normalized);
}
/** Exhaustive generated request bodies; no guessed URLs or optimistic audit changes. */
export async function postIncidentCommand(client: ApiClient, target: { id: string; signal: AbortSignal }, command: IncidentCommand) {
 const options = { params: { path: { id: target.id } }, signal: target.signal };
 switch (command.action) {
 case "comment": return unwrap(await client.POST("/api/v1/incidents/{id}/comments/", { ...options, body: command.body }));
 case "reassign": return unwrap(await client.POST("/api/v1/incidents/{id}/reassign/", { ...options, body: command.body }));
 case "change_severity": return unwrap(await client.POST("/api/v1/incidents/{id}/change-severity/", { ...options, body: command.body }));
 case "close": return unwrap(await client.POST("/api/v1/incidents/{id}/close/", { ...options, body: command.body }));
 case "void": return unwrap(await client.POST("/api/v1/incidents/{id}/void/", { ...options, body: command.body }));
 }
}
export function incidentFailure(error: unknown) {
 if (error instanceof ApiError && error.status === 409) return "conflict";
 if (error instanceof ApiError && error.status < 500) return "rejected";
 return "uncertain";
}
