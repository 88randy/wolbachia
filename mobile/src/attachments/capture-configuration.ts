import type { Attachments } from "./create-attachments.ts";
import { EvidenceError } from "./types.ts";
import type {
  Draft,
  EvidencePort,
  EvidenceCaptureContext,
} from "../features/ovitrap-check/types.ts";
import type { OvitrapStore } from "../features/ovitrap-check/store.ts";

/** Shared production wiring: capture owns bytes; the existing enqueue transaction binds them. */
export function captureConfiguration(input: {
  port: EvidencePort;
  store: OvitrapStore;
  attachments: Pick<Attachments, "capture" | "store" | "session"> | undefined;
}) {
  return {
    evidence: {
      capture: async (context: EvidenceCaptureContext) => {
        if (!input.attachments) throw new EvidenceError("owner_unproven");
        return input.attachments.capture.capture(input.port, {
          ...context,
          guard: input.store.evidenceCaptureGuard(context.draftId),
        });
      },
    },
    evidenceBindings: async (draft: Draft) => {
      if (!draft.evidence.length) return [];
      if (!input.attachments) throw new EvidenceError("owner_unproven");
      const fence = await input.attachments.session.capture();
      return input.attachments.store.bindingStatements({
        eventId: draft.eventId,
        evidenceIds: draft.evidence.map((item) => item.id),
        fence,
      });
    },
  };
}
