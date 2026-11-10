import type { Schemas } from "@wolbachia/api-client";
import type { EvidenceIdentity } from "../../attachments/evidence-session.ts";
import { ownerKey } from "../../attachments/types.ts";
import { activeFeedback } from "../ovitrap-lifecycle/feedback.ts";
import type { DayBundleService } from "../day/bundle-service.ts";
import type { FuelStore } from "./store.ts";
import { efficiencyAdvisory, serverFuelAdvisory, FuelError } from "./domain.ts";
import type { FuelDraft, FuelState } from "./types.ts";

export const EMPTY_FUEL: FuelState = {
  ready: false,
  canBegin: false,
  draft: null,
  drafts: [],
  event: null,
  receiptPending: true,
  review: null,
  advisory: { kind: "insufficient", efficiencyKmL: null, minimum: null, maximum: null },
};
function draftAdvisory(draft: FuelDraft) {
  return efficiencyAdvisory({
    baseline: null,
    rules: null,
    current: {
      deviceTime: draft.deviceTime,
      litres: draft.litres,
      odometer: Number(draft.odometer),
      isFullRefill: draft.isFullRefill,
    },
  });
}
async function storedDetails(stored: Awaited<ReturnType<FuelStore["read"]>>, store: FuelStore) {
  if (stored === null) return EMPTY_FUEL;
  const { draft, event } = stored;
  return {
    draft,
    event,
    advisory: serverFuelAdvisory(event?.result ?? null) ?? draftAdvisory(draft),
    receiptPending: await store.receiptPending(draft.receipt?.id ?? null),
  };
}
async function sourceState(input: {
  bundle: Pick<DayBundleService, "withFuelContext">;
  store: FuelStore;
  eventId: string | null;
}) {
  try {
    return await input.bundle.withFuelContext(async ({ handle }) => {
      const history = await activeFeedback(input.store.db, handle);
      const reviews = history.filter(
        (entry): entry is Schemas["ReviewHistoryEntry"] =>
          entry.kind === "review_decision" && entry.source_event_id === input.eventId,
      );
      return {
        ready: true,
        review: reviews.reduce<Schemas["ReviewHistoryEntry"] | null>(
          (latest, row) => (latest === null || row.revision > latest.revision ? row : latest),
          null,
        ),
      };
    });
  } catch (error) {
    if (!(error instanceof FuelError)) throw error;
    return { ready: false, review: null };
  }
}
/** Downloaded review is observed separately; neither it nor an efficiency advisory mutates a capture. */
export async function readFuelState(input: {
  identity: EvidenceIdentity;
  selected: string | null;
  store: FuelStore;
  bundle: Pick<DayBundleService, "withFuelContext">;
}): Promise<FuelState> {
  const key = ownerKey(input.identity.owner),
    drafts = await input.store.list(key);
  const selected = input.selected ?? drafts[0]?.eventId ?? null;
  const stored = selected === null ? null : await input.store.read(selected, key);
  return {
    ...EMPTY_FUEL,
    ...(await storedDetails(stored, input.store)),
    ...(await sourceState({ ...input, eventId: stored?.draft.eventId ?? null })),
    drafts,
  };
}
