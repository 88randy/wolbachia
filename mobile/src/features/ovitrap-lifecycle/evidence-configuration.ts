import type { Attachments } from "../../attachments/create-attachments.ts";
import { EvidenceError } from "../../attachments/types.ts";
import type { EvidencePort, EvidenceCaptureContext } from "../ovitrap-check/types.ts";
import type { LifecycleDraft, LifecycleSourceTurn } from "./types.ts";
import type { LifecycleStore } from "./store.ts";
interface Input {
  readonly store: LifecycleStore;
  readonly port: EvidencePort | undefined;
  readonly attachments: Pick<Attachments, "capture" | "store" | "session"> | undefined;
}
/** Canonical246 adoption/enrollment, retaining the displayed UUID and original interactive admission. */
export function lifecycleEvidence(input: Input) {
  return {
    evidence: { capture: (context: EvidenceCaptureContext) => adoptEvidence(input, context) },
    evidenceBindings: (draft: LifecycleDraft, turn: LifecycleSourceTurn) =>
      enrollEvidence(input, draft, turn),
  };
}
async function adoptEvidence(input: Input, context: EvidenceCaptureContext) {
  if (!input.port) return null;
  if (!input.attachments) throw new EvidenceError("owner_unproven");
  return input.attachments.capture.capture(input.port, {
    ...context,
    guard: input.store.evidenceCaptureGuard(context.draftId),
  });
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
