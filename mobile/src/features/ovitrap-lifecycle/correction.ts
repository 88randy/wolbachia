import type { SqlStatement } from "../../db/sql.ts";
import type { Dependencies } from "./ports.ts";
import type { Correction } from "./events.ts";
import { correctionEvent } from "./events.ts";
import { identityGuard } from "./store.ts";
import type { LifecycleDraft, Configuration } from "./types.ts";
import type { RelocationProposal } from "./types.ts";
import { validCorrectionReason } from "./domain.ts";
export async function commitCorrection(
  deps: Dependencies,
  draft: LifecycleDraft,
  input: Correction & {
    readonly configuration: Configuration;
    readonly proposal: RelocationProposal | null;
  },
): Promise<void> {
  const { configuration, proposal, ...correction } = input;
  validateCorrection(configuration, correction);
  if (
    proposal?.decision ||
    proposal?.legacyDecision ||
    (proposal && proposal.status !== "proposed")
  )
    throw new Error("Decided proposals retain dependents.");
  const time = new Date(
    Math.max(deps.now().getTime(), Date.parse(draft.deviceTime) + 1),
  ).toISOString();
  const event = correctionEvent({ draft, id: deps.uuid(), time, correction });
  const statements: SqlStatement[] = [
    identityGuard(draft.eventId),
    {
      sql: "INSERT INTO lifecycle_void(event_id,target_event_id,reason_code,reason) VALUES(?,?,?,?)",
      params: [event.id, draft.eventId, correction.reasonCode, String(event.payload.reason)],
    },
  ];
  await deps.engine.enqueue(event, statements);
}

function validateCorrection(configuration: Configuration, correction: Correction): void {
  const option = configuration.catalog?.voidReasons.find(
    (item) => item.code === correction.reasonCode,
  );
  if (!validCorrectionReason(correction.reason, option, configuration.limits))
    throw new Error("A delivered void reason and current Me limits are required.");
}
