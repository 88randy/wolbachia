import type { OvitrapService, Snapshot } from "./service.ts";
import type { Draft } from "./types.ts";
/** Edit the confirmation that was displayed, even when later local reads failed. */
export function editConfirmation(service: OvitrapService, draft: Draft): Promise<Snapshot> {
  return service.update({ step: draft.mode === "place" ? "point" : "finding" }, draft.eventId);
}
