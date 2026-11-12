import { ownerKey } from "../../attachments/types.ts";
import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { ReceiptStore } from "./store.ts";
import type { ReceiptState } from "./receipt-types.ts";
import { SupplyProjectionUnavailable } from "./projection-types.ts";
import { activeFeedback } from "../ovitrap-lifecycle/feedback.ts";
import type { SupplyProjectionSource } from "./projection-types.ts";
import type { Schemas } from "@wolbachia/api-client";
export const EMPTY_RECEIPT: ReceiptState = {
  ready: false,
  shiftId: null,
  assignments: [],
  drafts: [],
  draft: null,
  event: null,
  feedback: null,
  signaturePending: false,
};
async function readSource(input: {
  bundle: Pick<DayBundleService, "withSupplyAssignments">;
  store: ReceiptStore;
  eventId: string | null;
}) {
  try {
    return await input.bundle.withSupplyAssignments(async (source) => ({
      ready: true,
      assignments: source.assignments,
      review: await latestReview({ store: input.store, source, eventId: input.eventId }),
    }));
  } catch (error) {
    if (!(error instanceof SupplyProjectionUnavailable)) throw error;
    return { ready: false, assignments: [], review: null };
  }
}
export async function readReceiptState(input: {
  readonly identity: EvidenceIdentity;
  readonly selected: string | null;
  readonly store: ReceiptStore;
  readonly bundle: Pick<DayBundleService, "withSupplyAssignments">;
  readonly feedback: ReceiptState["feedback"];
  readonly shiftId?: string | null;
}): Promise<ReceiptState> {
  const drafts = await input.store.list(ownerKey(input.identity.owner));
  const selected = input.selected ?? drafts[0]?.eventId ?? null;
  const stored = selected ? await input.store.read(selected, ownerKey(input.identity.owner)) : null;
  return {
    ...EMPTY_RECEIPT,
    ...(await readSource({
      bundle: input.bundle,
      store: input.store,
      eventId: stored?.draft.eventId ?? null,
    })),
    drafts,
    shiftId: input.shiftId ?? null,
    feedback: input.feedback,
    ...(await receiptDetails(stored, input.store)),
  };
}
async function receiptDetails(
  stored: Awaited<ReturnType<ReceiptStore["read"]>>,
  store: ReceiptStore,
) {
  return {
    draft: stored?.draft ?? null,
    event: stored?.event ?? null,
    signaturePending: await store.signaturePending(stored?.draft.signature?.id ?? null),
  };
}
async function latestReview(input: {
  store: ReceiptStore;
  source: SupplyProjectionSource;
  eventId: string | null;
}): Promise<Schemas["ReviewHistoryEntry"] | null> {
  const history = await activeFeedback(input.store.db, input.source.handle);
  const decisions = history.filter(
    (entry): entry is Schemas["ReviewHistoryEntry"] =>
      entry.kind === "review_decision" && entry.source_event_id === input.eventId,
  );
  return decisions.reduce<Schemas["ReviewHistoryEntry"] | null>(
    (latest, next) => (latest === null || next.revision > latest.revision ? next : latest),
    null,
  );
}
