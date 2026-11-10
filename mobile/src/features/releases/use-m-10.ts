import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import type { AppServices } from "../../app/create-services.ts";
import { useServices } from "../../app/services-context.ts";
import { ownerKey } from "../../attachments/types.ts";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { resultMessageKey } from "../../sync/inbox-model.ts";
import { canSaveRelease, cachedReleaseGates, quantityUnits } from "./domain.ts";
import { releaseEditBuffer } from "./edit-buffer.ts";
import { ReleaseEditorController } from "./editor-controller.ts";
import type { ReleaseEditorSnapshot } from "./editor-controller.ts";
import type { ReleaseDraft, ReleaseSelection, ReleaseState } from "./types.ts";
import type { ReleaseViewModel, ReleaseViewStatus } from "./view-model.ts";

const EMPTY: ReleaseState = {
  draft: null,
  event: null,
  ready: false,
  canRestart: false,
  evidencePending: false,
  review: null,
  tasks: [],
  devices: [],
  gates: cachedReleaseGates({
    permit: null,
    eligibility: null,
    gps: null,
    now: new Date(0),
    isConfigured: false,
  }),
};
function identityKey(services: AppServices): string | null {
  const identity = services.attachments.session.deps.current();
  return identity ? JSON.stringify([ownerKey(identity.owner), identity.sessionId]) : null;
}
function useReleaseEditor(selection: ReleaseSelection) {
  const services = useServices();
  const { taskId, deviceId, manualCapture } = selection;
  const controller = useMemo(
    () =>
      new ReleaseEditorController({
        service: services.releases,
        selection: { taskId, deviceId, manualCapture },
        buffer: releaseEditBuffer(services.releases),
        refreshBundle: () => services.day.bundle.refresh(),
        identityKey: () => identityKey(services),
        subscribeScope: services.day.bundle.subscribe,
        isUnlocked: () => services.auth.getSnapshot().phase === "unlocked",
        subscribeAuth: services.auth.subscribe,
        subscribeSync: services.engine.subscribe,
      }),
    [services, taskId, deviceId, manualCapture],
  );
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => {
    controller.start();
    return () => {
      controller.stop();
    };
  }, [controller]);
  return { controller, snapshot };
}
function captureStatus(state: ReleaseState): ReleaseViewStatus {
  if (!state.event) return "draft";
  if (state.event.status === "sent") return "server_received";
  if (state.event.status === "in_review") return "in_review";
  if (state.event.status === "rejected") return "critical_rejected";
  return "phone_saved";
}
function reviewKey(state: ReleaseState): MessageKey | null {
  const review = state.review;
  if (!review || review.source_event_id !== state.event?.envelope.id) return null;
  if (review.effect_state === "applied_review") return "mobile.release.reviewApplied";
  if (review.effect_state === "discarded") return "mobile.release.reviewDiscarded";
  return "mobile.release.reviewObserved";
}
function capturePresentation(state: ReleaseState) {
  return {
    refs: captureReferences(state.draft),
    ...captureFields(state.draft),
    status: captureStatus(state),
    resultKey: resultMessageKey(state.event?.result ?? null),
    reviewedKey: reviewKey(state),
    evidencePending: state.evidencePending,
    gates: state.gates,
  };
}
function captureReferences(draft: ReleaseDraft | null) {
  if (!draft) return { taskId: null, deviceId: null, permitId: null, lotId: null };
  return {
    taskId: draft.pins.task.id,
    deviceId: draft.pins.device.id,
    permitId: draft.pins.permit.id,
    lotId: draft.pins.device.source_lot_id,
  };
}
function captureFields(draft: ReleaseDraft | null) {
  if (!draft)
    return {
      quantity: "",
      gpsAccuracy: null,
      evidenceCount: 0,
      photoUri: null,
      requiresEvidence: null,
    };
  return {
    quantity: draft.quantity,
    gpsAccuracy: draft.gps?.accuracy_m ?? null,
    evidenceCount: draft.evidence.length,
    photoUri: draft.evidence.at(-1)?.fileRef ?? null,
    requiresEvidence: draft.pins.custody.requires_evidence ? true : null,
  };
}
function selectionPresentation(snapshot: ReleaseEditorSnapshot, state: ReleaseState) {
  const selection = snapshot.selection;
  return {
    taskOptions: state.tasks,
    deviceOptions: state.devices,
    selectedTaskId: state.draft?.pins.task.id ?? selection.taskId,
    selectedDeviceId: state.draft?.pins.device.id ?? selection.deviceId,
    hasDraft: state.draft !== null,
    canBegin:
      state.draft === null &&
      state.tasks.some(({ id }) => id === selection.taskId) &&
      state.devices.some(({ id }) => id === selection.deviceId),
  };
}
function formPresentation(input: {
  readonly snapshot: ReleaseEditorSnapshot;
  readonly hasPending: boolean;
}) {
  const state = input.snapshot.state ?? EMPTY;
  return {
    canEdit: state.ready && state.event === null && state.draft !== null,
    canSave: canSaveForm({ ...input, state }),
    quantityErrorKey: quantityError(input.snapshot),
    hasPendingEdits: input.hasPending,
    canRestart: state.draft !== null && state.event === null && state.canRestart,
  };
}
function canSaveForm(input: {
  readonly state: ReleaseState;
  readonly snapshot: ReleaseEditorSnapshot;
  readonly hasPending: boolean;
}): boolean {
  return (
    input.state.ready &&
    input.state.event === null &&
    canSaveRelease(input.state.gates) &&
    !input.hasPending &&
    !input.snapshot.isBusy &&
    input.snapshot.errorKey === null
  );
}
function quantityError(snapshot: ReleaseEditorSnapshot): MessageKey | null {
  const draft = snapshot.state?.draft;
  if (!draft || snapshot.touchedId !== draft.eventId) return null;
  const quantity = quantityUnits(draft.quantity);
  return quantity === null || quantity === 0n ? "mobile.release.detailQuantityInvalid" : null;
}
function useReleaseNavigation() {
  const { push } = useNavigation();
  const report = () => {
    push({ name: "incidents" });
  };
  return {
    reportSupervisor: report,
    reportDevice: report,
    openInbox: () => {
      push({ name: "inbox" });
    },
    goBackToDay: () => {
      push({ name: "day" });
    },
  };
}
function editorActions(controller: ReleaseEditorController) {
  return {
    begin: controller.begin,
    restart: controller.restart,
    changeQuantity: controller.editQuantity,
    blurQuantity: controller.blurQuantity,
    acquireGps: controller.locate,
    capturePhoto: controller.photo,
    undoPhoto: controller.undoPhoto,
    save: controller.save,
    retry: controller.retry,
    selectTask: (id: string) => {
      controller.choose("taskId", id);
    },
    selectDevice: (id: string) => {
      controller.choose("deviceId", id);
    },
  };
}
/** P18 keeps raw edits and original evidence local; only persisted outbox state can claim Saved. */
export function useM10(selection: ReleaseSelection): ReleaseViewModel {
  const { controller, snapshot } = useReleaseEditor(selection);
  const navigation = useReleaseNavigation();
  const state = snapshot.state ?? EMPTY;
  return {
    ...capturePresentation(state),
    ...selectionPresentation(snapshot, state),
    ...formPresentation({ snapshot, hasPending: controller.hasPending() }),
    ...editorActions(controller),
    ...navigation,
    isLoading: snapshot.state === null && snapshot.errorKey === null,
    isBusy: snapshot.isBusy,
    errorKey: snapshot.errorKey,
  };
}
