import type { Attachments } from "../../attachments/create-attachments.ts";
import { EvidenceError } from "../../attachments/types.ts";
import type { EvidencePort } from "../ovitrap-check/types.ts";
import type { LifecycleDraft, LifecycleSourceTurn, LifecycleAdmission } from "./types.ts";
interface Input {
  readonly port: EvidencePort | undefined;
  readonly attachments: Pick<Attachments, "capture" | "store" | "session"> | undefined;
}
/** Canonical246 adoption/enrollment, retaining the displayed UUID and original interactive admission. */
export function lifecycleEvidence(input: Input) {
  return {
    captureEvidence: (draftId: string, admission: LifecycleAdmission) =>
      adoptEvidence(input, draftId, admission),
    evidenceBindings: (draft: LifecycleDraft, turn: LifecycleSourceTurn) =>
      enrollEvidence(input, draft, turn),
  };
}
async function adoptEvidence(input: Input, draftId: string, admission: LifecycleAdmission) {
  if (!input.port) return null;
  if (!input.attachments) throw new EvidenceError("owner_unproven");
  const port = input.port;
  return input.attachments.capture.capture(
    {
      capture: () => {
        admission.assertCurrent();
        return port.capture();
      },
    },
    draftId,
  );
}
async function enrollEvidence(input: Input, draft: LifecycleDraft, turn: LifecycleSourceTurn) {
  if (!input.attachments) throw new EvidenceError("owner_unproven");
  const fence = await input.attachments.session.capture();
  if (
    fence.ownerKey !== turn.ownerFence.ownerKey ||
    fence.sessionId !== turn.ownerFence.sessionId ||
    fence.generation !== turn.ownerFence.generation
  )
    throw new EvidenceError("stale_context");
  return input.attachments.store.bindingStatements({
    eventId: draft.eventId,
    evidenceIds: draft.evidence.map((item) => item.id),
    fence,
  });
}
