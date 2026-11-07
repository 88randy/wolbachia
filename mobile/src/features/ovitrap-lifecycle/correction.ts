import { validReason } from "../ovitrap-check/domain.ts";
import type { SqlStatement } from "../../db/sql.ts";
import type { Dependencies } from "./ports.ts";
import type { Correction } from "./events.ts";
import { correctionEvent } from "./events.ts";
import { identityGuard } from "./store.ts";
import type { LifecycleDraft, Configuration } from "./types.ts";
export async function commitCorrection(
  deps: Dependencies,
  draft: LifecycleDraft,
  input: Correction & { readonly configuration: Configuration },
): Promise<void> {
  const { configuration, ...correction } = input;
  const { catalog } = configuration;
  if (
    !catalog?.voidReasons.some((item) => item.code === correction.reasonCode) ||
    !validReason(correction.reason)
  )
    throw new Error("A delivered void reason and 10..1000 visible characters are required.");
  const proposal = (await deps.store.read()).proposal;
  if (proposal?.decision) throw new Error("Decided proposals retain dependents.");
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
