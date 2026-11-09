import type { Schemas } from "@wolbachia/api-client";
import type { LifecycleDraft, RelocationDecision, RelocationProposal } from "./types.ts";
import type { RetainedProposal } from "./retained-proposal.ts";
export function historyTask(task: Schemas["RelocationHistoryTask"] | null | undefined) {
  return task ? { id: task.id, code: task.code, dueDate: task.due_date } : null;
}
function historyDecision(
  eventId: string,
  decision: Schemas["RelocationHistoryDecision"] | null,
  task: Schemas["RelocationHistoryTask"] | null = null,
): RelocationDecision | null {
  return decision
    ? {
        id: decision.id,
        proposalEventId: eventId,
        status: decision.decision,
        reason: decision.reason,
        decidedAt: decision.decided_at,
        nextDayTask: historyTask(task),
      }
    : null;
}
/** A downloaded reference is not an owned draft, task assignment or original ingest receipt. */
export function historyProposal(entry: Schemas["RelocationHistoryEntry"]): RelocationProposal {
  return {
    eventId: entry.proposal_event_id,
    serverProposalId: entry.id,
    status: entry.status === "pending" ? "proposed" : entry.status,
    proposedLocation: entry.proposed_location,
    isVoided: entry.source_voided_at !== null,
    sourceVoidedAt: entry.source_voided_at,
    decision: historyDecision(entry.proposal_event_id, entry.decision, entry.next_day_task),
    nextDayTask: historyTask(entry.next_day_task),
    provenance: "downloaded",
    isTaskActionable: false,
  };
}
export function localProposal(
  draft: LifecycleDraft,
  decision: RelocationDecision | null,
  isVoided: boolean,
): RelocationProposal {
  if (!draft.proposedLocation) throw new Error("Proposal location missing.");
  return {
    eventId: draft.eventId,
    status: decision?.status ?? "proposed",
    proposedLocation: draft.proposedLocation,
    isVoided,
    decision,
    nextDayTask: decision?.nextDayTask ?? null,
    legacyDecision: decision,
    provenance: decision ? "legacy-local" : "local",
    isTaskActionable: false,
  };
}
interface CurrentProposal {
  readonly base: RelocationProposal;
  readonly entry: Schemas["RelocationHistoryEntry"] | null;
  readonly retained: RetainedProposal | null;
  readonly isTaskActionable: boolean;
}
export function currentProposal(input: CurrentProposal): RelocationProposal {
  const { base, entry, retained } = input;
  if (entry)
    return {
      ...historyProposal(entry),
      isVoided: base.isVoided || entry.source_voided_at !== null,
      legacyDecision: base.legacyDecision,
      isTaskActionable: input.isTaskActionable,
    };
  if (retained)
    return {
      ...base,
      status: retained.decision.decision,
      serverProposalId: retained.proposalId,
      decision: historyDecision(base.eventId, retained.decision),
      nextDayTask: null,
      provenance: "retained",
    };
  return { ...base, status: "proposed", decision: null, nextDayTask: null };
}
