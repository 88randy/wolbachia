import type { Attachments } from "./create-attachments.ts";
import { EvidenceError } from "./types.ts";
import type { Draft, EvidencePort } from "../features/ovitrap-check/types.ts";
import type { OvitrapStore } from "../features/ovitrap-check/store.ts";

/** Shared production wiring: capture owns bytes; the existing enqueue transaction binds them. */
export function captureConfiguration(input: {
  port: EvidencePort | undefined;
  store: OvitrapStore;
  attachments: Pick<Attachments, "capture" | "store" | "session"> | undefined;
}) {
  return {
    evidence: {
      capture: async () => {
        if (input.port === undefined) return null; // Native acquisition is #253, not an upload adapter.
        const { draft } = await input.store.read();
        if (!draft) return null;
        if (!input.attachments) throw new EvidenceError("owner_unproven");
        return input.attachments.capture.capture(input.port, draft.eventId);
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
