import { ownerKey } from "../../attachments/types.ts";
import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { ReceiptStore } from "./store.ts";
import type { ReceiptDraft, ReceiptState } from "./receipt-types.ts";
import { pendingDeliveries } from "./pending-deliveries.ts";
import { SupplyProjectionUnavailable } from "./projection-types.ts";
import { activeFeedback } from "../ovitrap-lifecycle/feedback.ts";
import type { SupplyProjectionSource } from "./projection-types.ts";
import type { Schemas } from "@wolbachia/api-client";
export const EMPTY_RECEIPT: ReceiptState = {
  ready: false,
  shiftId: null,
  assignments: [],
  drafts: [],
  openDrafts: [],
  draft: null,
  event: null,
  feedback: null,
  signaturePending: false,
};
type Stored = Awaited<ReturnType<ReceiptStore["read"]>>;
interface Choice {
  readonly store: ReceiptStore;
  readonly owner: string;
  readonly drafts: readonly ReceiptDraft[];
  readonly selected: string | null;
  readonly shiftId: string | null;
}
type Assignments = readonly Schemas["SupplyBundle"][];

const hasRelease = (assignments: Assignments, releaseId: string) =>
  assignments.some((assignment) => assignment.releases.some((release) => release.id === releaseId));

/**
 * A saved receipt is immutable and hides only the delivery it was made for (matched by release id).
 * It is shown only while that release is still in the bundle, and it never takes the place of a
 * delivery that has no receipt on this phone. With the bundle unavailable nothing can be matched,
 * so the newest receipt is kept as it was.
 */
async function chooseStored(
  choice: Choice,
  source: { readonly assignments: Assignments; readonly ready: boolean },
): Promise<Stored> {
  const { store, owner, drafts, selected } = choice;
  const isShown = (stored: NonNullable<Stored>) =>
    !source.ready ||
    stored.event === null ||
    hasRelease(source.assignments, stored.draft.releaseId);
  const current = selected === null ? null : await store.read(selected, owner);
  if (current !== null && isShown(current)) return current;
  if (!source.ready) return drafts[0] ? store.read(drafts[0].eventId, owner) : null;
  const all = await Promise.all(drafts.map((draft) => store.read(draft.eventId, owner)));
  const stored = all.filter((entry): entry is NonNullable<Stored> => entry !== null);
  const open = stored.find((entry) => entry.event === null);
  if (open) return open;
  const hasOffer =
    pendingDeliveries(
      source.assignments,
      choice.shiftId,
      drafts.map((draft) => draft.releaseId),
    ).length > 0;
  return hasOffer ? null : (stored.find((entry) => isShown(entry)) ?? null);
}
async function readSource(input: {
  bundle: Pick<DayBundleService, "withSupplyAssignments">;
  store: ReceiptStore;
  choice: Choice;
}) {
  try {
    return await input.bundle.withSupplyAssignments(async (source) => {
      const stored = await chooseStored(input.choice, {
        assignments: source.assignments,
        ready: true,
      });
      return {
        ready: true,
        assignments: source.assignments,
        stored,
        review: await latestReview({
          store: input.store,
          source,
          eventId: stored?.draft.eventId ?? null,
        }),
      };
    });
  } catch (error) {
    if (!(error instanceof SupplyProjectionUnavailable)) throw error;
    const stored = await chooseStored(input.choice, { assignments: [], ready: false });
    return { ready: false, assignments: [], stored, review: null };
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
  const owner = ownerKey(input.identity.owner);
  const drafts = await input.store.list(owner);
  const { stored, ...source } = await readSource({
    bundle: input.bundle,
    store: input.store,
    choice: {
      store: input.store,
      owner,
      drafts,
      selected: input.selected,
      shiftId: input.shiftId ?? null,
    },
  });
  return {
    ...EMPTY_RECEIPT,
    ...source,
    drafts,
    shiftId: input.shiftId ?? null,
    feedback: input.feedback,
    ...(await receiptDetails(stored, input.store, owner)),
  };
}
async function receiptDetails(
  stored: Awaited<ReturnType<ReceiptStore["read"]>>,
  store: ReceiptStore,
  owner: string,
) {
  return {
    openDrafts: await store.list(owner, true),
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
