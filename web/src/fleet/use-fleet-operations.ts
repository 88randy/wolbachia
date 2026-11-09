import { useEffect, useState } from "react";
import { ApiError } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { useQueryClient, CancelledError } from "@tanstack/react-query";
import { useVoidLimits } from "../void";
import { reportSessionError } from "../session/session-events";
import { useRetryWindow } from "../quadrants/geography/use-retry-window";
import type { TableState } from "../data-table/table-types";
import { canFleetAction } from "./use-fleet-scope";
import type { FleetRecordScope } from "./use-fleet-scope";
import { fleetRecordOptions, invalidateFleet } from "./fleet-query";
import type { MotorcycleDetail } from "./fleet-query";
import { fleetHistoryOptions } from "./fleet-history-query";
import { useFleetDraft } from "./fleet-drafts";
import type { FleetDraft } from "./fleet-drafts";
import {
  sendFleetCommand,
  serviceBody,
  clearanceReason,
  operationFailure,
  invalidServiceField,
  serviceErrors,
  FleetRateLimit,
} from "./fleet-operation";
import type { FleetCommand } from "./fleet-operation";
import { uploadFleetEvidence, isEvidenceFile } from "./fleet-evidence";
import type { FleetEvidence } from "./fleet-evidence";
interface RecordState {
  data: MotorcycleDetail | null | undefined;
  error: unknown;
  isFetching: boolean;
  isPlaceholderData: boolean;
}
const required = {
  service: ["motorcycle.manage"],
  clear: ["motorcycle.service_clear", "field.upload"],
};
function permitted(scope: FleetRecordScope, draft: FleetDraft) {
  return required[draft.kind].every((permission) =>
    canFleetAction(scope, draft.center, permission),
  );
}
function useDraftRetirement(
  scope: FleetRecordScope,
  store: ReturnType<typeof useFleetDraft>,
  record: RecordState,
) {
  useEffect(() => {
    const draft = store.read();
    const denied =
      record.data === null ||
      (record.error instanceof ApiError && [403, 404].includes(record.error.status));
    if (draft && scope.identity.isSettled && (denied || !permitted(scope, draft)))
      store.write(undefined);
  }, [scope, store, record]);
}
function useOperationNotice(scope: FleetRecordScope) {
  const [notice, setNotice] = useState<{ context: string; kind: "saved" | "denied" }>();
  return {
    saved: notice?.context === scope.context && notice.kind === "saved",
    denied: notice?.context === scope.context && notice.kind === "denied",
    setSaved: (saved: boolean) => {
      setNotice(saved ? { context: scope.context, kind: "saved" } : undefined);
    },
    setDenied: () => {
      setNotice({ context: scope.context, kind: "denied" });
    },
  };
}
export function useFleetOperations(scope: FleetRecordScope, record: RecordState) {
  const store = useFleetDraft();
  const cache = useQueryClient();
  const limits = useVoidLimits();
  const notice = useOperationNotice(scope);
  const cooling = useRetryWindow(store.draft?.retryAt ?? 0);
  useDraftRetirement(scope, store, record);
  const context = {
    scope,
    store,
    cache,
    limits,
    record,
    setSaved: notice.setSaved,
    setDenied: notice.setDenied,
  };
  return {
    draft: store.draft,
    saved: notice.saved,
    denied: notice.denied,
    limits,
    cooling,
    ...draftState(context),
    ...draftControls(context),
  };
}
function draftState(context: Context) {
  const { store, scope, record } = context;
  const draft = store.draft;
  return {
    requiresReview: draft?.kind === "clear" && draft.revision !== record.data?.revision,
    visible:
      !!draft &&
      permitted(scope, draft) &&
      record.data?.id === draft.motorcycle &&
      record.data.center === draft.center,
    isUnverified: !ready(context),
    inspectedRevision: inspectedRevision(context),
  };
}
function inspectedRevision(context: Context) {
  const readback = context.store.draft?.readback;
  return readback?.context === context.scope.context ? readback.revision : undefined;
}
function draftControls(context: Context) {
  const close = () => {
    if (context.store.read()?.phase === "idle") context.store.write(undefined);
  };
  return {
    openService: () => {
      openDraft(context);
    },
    openClear: (fault: Schemas["Incident"], state: TableState) => {
      openDraft(context, { fault, state });
    },
    close,
    discard: close,
    change: (field: string, value: string) => {
      changeValue(context, field, value);
    },
    blur: (field: string) => {
      validateField(context, field);
    },
    select: (files: File[]) => {
      selectFiles(context, files);
    },
    upload: () => uploadFiles(context),
    submit: () => submit(context),
    review: () => review(context),
  };
}
type Context = {
  scope: FleetRecordScope;
  store: ReturnType<typeof useFleetDraft>;
  cache: ReturnType<typeof useQueryClient>;
  limits: ReturnType<typeof useVoidLimits>;
  record: RecordState;
  setSaved: (value: boolean) => void;
  setDenied: () => void;
};
function ready(context: Context) {
  const record = context.record.data;
  return context.scope.identity.isSettled &&
    context.scope.isCurrent() &&
    !context.record.isFetching &&
    !context.record.isPlaceholderData &&
    context.record.error === null &&
    record &&
    !record.voided_at
    ? record
    : undefined;
}
function openDraft(context: Context, source?: { fault: Schemas["Incident"]; state: TableState }) {
  const record = ready(context);
  if (!record) return;
  const draft: FleetDraft = {
    intent: context.store.nextIntent(),
    kind: source ? "clear" : "service",
    motorcycle: record.id,
    center: record.center,
    revision: record.revision,
    values: {},
    files: [],
    phase: "idle",
    ...(source ? { fault: source.fault, sourceState: source.state } : {}),
  };
  if (source && (source.fault.motorcycle !== record.id || source.fault.is_cleared)) return;
  if (!permitted(context.scope, draft)) return;
  context.setSaved(false);
  context.store.write(draft);
}
function changeValue(context: Context, field: string, value: string) {
  const draft = context.store.read();
  if (
    !draft ||
    draft.phase !== "idle" ||
    draft.failure === "uncertain" ||
    !permitted(context.scope, draft)
  )
    return;
  context.store.patch(draft.intent, (previous) => ({
    ...previous,
    values: { ...previous.values, [field]: value },
    invalidFields: {
      ...previous.invalidFields,
      [field]:
        previous.invalidFields?.[field] === true &&
        fieldInvalid(context, previous, { name: field, value }),
    },
  }));
}
function fieldInvalid(context: Context, draft: FleetDraft, field: { name: string; value: string }) {
  if (draft.kind === "service") return invalidServiceField(field.name, field.value);
  try {
    clearanceReason(field.value, context.limits);
    return false;
  } catch {
    return true;
  }
}
function validateField(context: Context, field: string) {
  const draft = context.store.read();
  if (!draft || draft.phase !== "idle") return;
  context.store.patch(draft.intent, (previous) => ({
    ...previous,
    invalidFields: {
      ...previous.invalidFields,
      [field]: fieldInvalid(context, previous, {
        name: field,
        value: previous.values[field] ?? "",
      }),
    },
  }));
}
function selectFiles(context: Context, files: File[]) {
  const draft = context.store.read();
  if (
    !draft ||
    draft.kind !== "clear" ||
    draft.phase !== "idle" ||
    draft.failure === "uncertain" ||
    !permitted(context.scope, draft)
  )
    return;
  const invalid = files.length > 50 || files.some((file) => !isEvidenceFile(file));
  context.store.patch(draft.intent, (previous) => ({
    ...previous,
    files: files.length > 50 ? [] : files.map((file) => ({ file, clientId: crypto.randomUUID() })),
    evidenceFailed: false,
    evidenceInvalid: invalid,
  }));
}
function commandOf(context: Context, draft: FleetDraft): FleetCommand {
  if (draft.kind === "service")
    return { kind: "service", motorcycle: draft.motorcycle, body: serviceBody(draft.values) };
  const ids = draft.files.map((file) => (file.verifiedAt ? file.uploadId : undefined));
  if (
    !draft.fault ||
    !ids.length ||
    ids.some((id) => !id) ||
    draft.revision !== context.record.data?.revision
  )
    throw new Error("Unreviewed fleet evidence");
  return {
    kind: "clear",
    motorcycle: draft.motorcycle,
    body: {
      fault_id: draft.fault.id,
      expected_revision: draft.revision,
      evidence_ids: ids.filter((id): id is string => !!id),
      reason: clearanceReason(draft.values["reason"] ?? "", context.limits),
    },
  };
}
function start(context: Context, phase: FleetDraft["phase"]) {
  const draft = context.store.read();
  const target = phase === "review" ? context.record.data : ready(context);
  if (
    !draft ||
    draft.phase !== "idle" ||
    target?.id !== draft.motorcycle ||
    (draft.retryAt ?? 0) > Date.now() ||
    !permitted(context.scope, draft)
  )
    return;
  const guard = context.scope.begin();
  const isCurrent = () =>
    !guard.isStale() && context.scope.isCurrent() && context.store.read()?.intent === draft.intent;
  if (!isCurrent()) return;
  context.store.patch(draft.intent, (previous) => ({ ...previous, phase }));
  return { draft, guard, isCurrent };
}
function captureCommand(context: Context, draft: FleetDraft) {
  try {
    return structuredClone(commandOf(context, draft));
  } catch {
    context.store.patch(draft.intent, (previous) => ({
      ...previous,
      failure: "invalid",
      invalidFields: draft.kind === "service" ? serviceErrors(draft.values) : { reason: true },
    }));
  }
}
type Call = NonNullable<ReturnType<typeof start>>;
function fieldsFrom(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 400 || !error.envelope?.fields) return {};
  return {
    invalidFields: Object.fromEntries(
      Object.keys(error.envelope.fields).map((field) => [field, true]),
    ),
  };
}
async function failedWrite(context: Context, call: Call, error: unknown) {
  if (!call.isCurrent()) return;
  const failure = operationFailure(error);
  if (failure === "denied") {
    context.store.write(undefined);
    context.setDenied();
  } else
    context.store.patch(call.draft.intent, (previous) => ({
      ...previous,
      failure,
      retryAt: error instanceof FleetRateLimit ? error.retryAt : (previous.retryAt ?? 0),
      ...fieldsFrom(error),
    }));
  reportSessionError(error, context.cache);
  if (failure === "conflict") await invalidateFleet(context.cache);
}
function assertWriteTarget(
  command: FleetCommand,
  saved: Schemas["Motorcycle"] | Schemas["ServiceRecord"],
) {
  const target =
    command.kind === "clear" ? saved.id : "motorcycle" in saved ? saved.motorcycle : undefined;
  if (target !== command.motorcycle) throw new Error("Unproved fleet write target");
}
async function submit(context: Context) {
  const draft = context.store.read();
  if (!draft || draft.failure === "conflict" || draft.failure === "uncertain") return;
  const command = captureCommand(context, draft);
  if (!command) return;
  const call = start(context, "write");
  if (!call) return;
  context.store.patch(draft.intent, (previous) => ({ ...previous, command, failure: "uncertain" }));
  try {
    const saved = await sendFleetCommand(context.scope.client, command, call.guard.signal);
    if (!call.isCurrent()) return;
    assertWriteTarget(command, saved);
    await invalidateFleet(context.cache);
    if (call.isCurrent()) {
      context.store.write(undefined);
      context.setSaved(true);
    }
  } catch (error) {
    await failedWrite(context, call, error);
  } finally {
    context.store.patch(draft.intent, (previous) => ({ ...previous, phase: "idle" }));
  }
}
async function uploadFiles(context: Context) {
  if (context.store.read()?.kind !== "clear" || context.store.read()?.evidenceInvalid) return;
  const call = start(context, "upload");
  if (!call || call.draft.kind !== "clear" || !call.draft.fault) return;
  try {
    for (const evidence of call.draft.files) await uploadOne(context, call, evidence);
  } catch (error) {
    failedUpload(context, call, error);
  } finally {
    context.store.patch(call.draft.intent, (previous) => ({ ...previous, phase: "idle" }));
  }
}
async function uploadOne(context: Context, call: Call, evidence: FleetEvidence) {
  const fault = call.draft.fault?.id;
  if (!fault) return;
  const update = (receipt: { uploadId: string; verifiedAt?: string }) => {
    context.store.patch(call.draft.intent, (previous) => ({
      ...previous,
      files: previous.files.map((file) =>
        file.clientId === evidence.clientId ? { ...file, ...receipt } : file,
      ),
    }));
  };
  const receipt = await uploadFleetEvidence({
    scope: context.scope,
    evidence,
    fault,
    signal: call.guard.signal,
    requireCurrent: () => {
      if (!call.isCurrent()) throw new CancelledError();
    },
    onAuthorized: (id) => {
      update({ uploadId: id });
    },
  });
  if (call.isCurrent()) update(receipt);
}
function failedUpload(context: Context, call: Call, error: unknown) {
  if (!call.isCurrent()) return;
  if (operationFailure(error) === "denied") {
    context.store.write(undefined);
    context.setDenied();
  } else
    context.store.patch(call.draft.intent, (previous) => ({
      ...previous,
      evidenceFailed: true,
      retryAt: error instanceof FleetRateLimit ? error.retryAt : (previous.retryAt ?? 0),
    }));
  reportSessionError(error, context.cache);
}
async function currentFault(context: Context, call: Call, record: MotorcycleDetail) {
  if (!call.draft.fault) return true;
  if (!call.draft.sourceState) return false;
  const page = await context.cache.query({
    ...fleetHistoryOptions(
      context.scope,
      { motorcycle: record.id, tab: "incidents" },
      call.draft.sourceState,
    ),
    staleTime: 0,
    retry: false,
  });
  return (
    call.isCurrent() &&
    page.results.some(
      (row) => "is_cleared" in row && row.id === call.draft.fault?.id && !row.is_cleared,
    )
  );
}
function reviewedRecord(call: Call, record: MotorcycleDetail | null) {
  return (
    call.isCurrent() &&
    record !== null &&
    record.id === call.draft.motorcycle &&
    record.center === call.draft.center
  );
}
function retainUnknown(context: Context, call: Call, record: MotorcycleDetail) {
  if (call.draft.failure !== "uncertain") return false;
  context.store.patch(call.draft.intent, (previous) => ({
    ...previous,
    readback: { context: context.scope.context, revision: record.revision },
  }));
  return true;
}
async function review(context: Context) {
  const call = start(context, "review");
  if (!call) return;
  try {
    const record = await context.cache.query({
      ...fleetRecordOptions(context.scope, context.scope.code),
      staleTime: 0,
      retry: false,
    });
    if (!record || !reviewedRecord(call, record)) return;
    if (retainUnknown(context, call, record) || record.voided_at) return;
    if (!(await currentFault(context, call, record))) return;
    if (call.isCurrent())
      context.store.write({
        ...call.draft,
        intent: context.store.nextIntent(),
        revision: record.revision,
        phase: "idle",
        failure: undefined,
      });
  } catch (error) {
    if (call.isCurrent()) reportSessionError(error, context.cache);
  } finally {
    context.store.patch(call.draft.intent, (previous) => ({ ...previous, phase: "idle" }));
  }
}
