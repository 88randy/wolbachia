import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { uploadTransferEvidence } from "../transfers/transfer-evidence";

export type PrepareBody = Schemas["PrepareInventoryIntentRequest"];
export type IntentTarget =
  | { kind: "justify"; reconciliationId: string }
  | { kind: "write_off" }
  | { kind: "release"; assignmentId: string };
export interface PreparedDraft {
  body: PrepareBody;
  target: IntentTarget;
  intentId?: string;
  /** Evidence the intent declared (by its `clientId`); uploaded bound to the intent before running it. */
  attachment?: { file: File; clientId: string };
}
export interface AssignDraft {
  body: Schemas["CreateAssignmentRequest"];
  target: { kind: "assign" };
}
/** The frozen command: only an explicit retry resends it, with the same command and intent ids. */
export type IntentDraft = PreparedDraft | AssignDraft;
export type IntentResult =
  | { kind: "assign"; assignment: Schemas["SupplyAssignmentRead"] }
  | { kind: "justify"; justification: Schemas["SupplyJustification"] }
  | { kind: "write_off"; writeOff: Schemas["WriteOffRead"] }
  | { kind: "release"; release: Schemas["ReleaseOutcome"] };
export interface IntentCall {
  client: ApiClient;
  signal: AbortSignal;
}
interface Execution {
  call: IntentCall;
  target: IntentTarget;
  intentId: string;
}

function isAssign(draft: IntentDraft): draft is AssignDraft {
  return draft.target.kind === "assign";
}

async function executeJustify(run: Execution, reconciliationId: string): Promise<IntentResult> {
  const answer = unwrap(
    await run.call.client.POST("/api/v1/reconciliations/{id}/justify/", {
      params: { path: { id: reconciliationId } },
      body: { intent_id: run.intentId },
      signal: run.call.signal,
    }),
  );
  return { kind: "justify", justification: answer.justification };
}

async function executeRelease(run: Execution, assignmentId: string): Promise<IntentResult> {
  const release = unwrap(
    await run.call.client.POST("/api/v1/courier-assignments/{id}/release/", {
      params: { path: { id: assignmentId } },
      body: { intent_id: run.intentId },
      signal: run.call.signal,
    }),
  );
  return { kind: "release", release };
}

async function execute(run: Execution): Promise<IntentResult> {
  const target = run.target;
  if (target.kind === "justify") return executeJustify(run, target.reconciliationId);
  if (target.kind === "release") return executeRelease(run, target.assignmentId);
  const answer = unwrap(
    await run.call.client.POST("/api/v1/write-offs/", {
      body: { intent_id: run.intentId },
      signal: run.call.signal,
    }),
  );
  return { kind: "write_off", writeOff: answer.write_off };
}

async function prepare(call: IntentCall, draft: PreparedDraft) {
  const prepared = unwrap(
    await call.client.POST("/api/v1/inventory-intents/", { body: draft.body, signal: call.signal }),
  );
  return prepared.intent.id;
}

/** Two idempotent steps: prepare the declared evidence, then execute the prepared intent. */
export async function runIntent(
  call: IntentCall,
  draft: IntentDraft,
  remember: (draft: PreparedDraft, intentId: string) => void,
): Promise<IntentResult> {
  if (isAssign(draft)) {
    const body = draft.body;
    const answer = unwrap(
      await call.client.POST("/api/v1/courier-assignments/", { body, signal: call.signal }),
    );
    return { kind: "assign", assignment: answer.assignment };
  }
  const intentId = draft.intentId ?? (await prepare(call, draft));
  remember(draft, intentId);
  if (draft.attachment)
    await uploadTransferEvidence({
      client: call.client,
      evidence: draft.attachment,
      signal: call.signal,
      requireCurrent: () => undefined,
      onAuthorized: () => undefined,
      context: { kind: "inventory_intent", id: intentId },
    });
  return execute({ call, target: draft.target, intentId });
}
