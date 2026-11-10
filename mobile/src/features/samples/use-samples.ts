import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import type { AppServices } from "../../app/create-services.ts";
import { useServices } from "../../app/services-context.ts";
import { ownerKey } from "../../attachments/types.ts";
import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import type { Locale } from "@wolbachia/i18n";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { resultMessageKey } from "../../sync/inbox-model.ts";
import { sampleEditBuffer } from "./edit-buffer.ts";
import { refreshSampleConfiguration } from "./refresh-configuration.ts";
import { SampleEditorController, sampleGateKey } from "./editor-controller.ts";
import type { SampleEditorSnapshot } from "./editor-controller.ts";
import type {
  SampleDraft,
  SampleOrigin,
  SampleSelection,
  SampleState,
  SampleWork,
} from "./types.ts";
import type { SampleViewModel, SampleViewStatus } from "./view-model.ts";

const EMPTY: SampleState = {
  draft: null,
  event: null,
  ready: false,
  canBegin: false,
  evidencePending: false,
  gates: ["configuration"],
  review: null,
  receipt: null,
  sources: [],
  origins: [],
  methods: [],
  work: [],
};
const SOURCE_KEYS = {
  reading: "mobile.sample.sourceReading",
  lot: "mobile.sample.sourceLot",
  release: "mobile.sample.sourceRelease",
} as const;
const STATUS_KEYS = {
  draft: "mobile.sample.draftStatus",
  pending: "mobile.sample.phoneSaved",
  sending: "mobile.sample.phoneSaved",
  error: "mobile.sample.phoneSaved",
  sent: "mobile.sample.serverReceived",
  in_review: "mobile.sample.inReview",
  rejected: "mobile.sample.rejected",
} as const;
function identityKey(services: AppServices): string | null {
  const identity = services.attachments.session.deps.current();
  return identity ? JSON.stringify([ownerKey(identity.owner), identity.sessionId]) : null;
}
function createController(services: AppServices, selection: SampleSelection) {
  return new SampleEditorController({
    service: services.samples,
    selection,
    buffer: sampleEditBuffer(services.samples),
    refreshBundle: (isCurrent) =>
      refreshSampleConfiguration(
        {
          refreshCatalog: () => services.shiftOpen.refreshCatalog(),
          refreshBootstrap: (force) => services.day.bundle.refresh(force),
        },
        isCurrent,
      ),
    identityKey: () => identityKey(services),
    subscribeScope: services.day.bundle.subscribe,
    isUnlocked: () => services.auth.getSnapshot().phase === "unlocked",
    subscribeAuth: services.auth.subscribe,
    subscribeSync: services.engine.subscribe,
  });
}
function useSampleEditor(selection: SampleSelection) {
  const services = useServices();
  const { sampleId, manualCapture } = selection;
  const kind = selection.sourceRef?.kind,
    sourceId = selection.sourceRef?.id;
  const controller = useMemo(
    () =>
      createController(services, {
        sampleId,
        manualCapture,
        sourceRef: kind && sourceId ? { kind, id: sourceId } : null,
      }),
    [services, sampleId, manualCapture, kind, sourceId],
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
function captureStatus(state: SampleState): SampleViewStatus {
  if (!state.event) return "draft";
  if (state.event.status === "sent") return "server_received";
  if (state.event.status === "in_review") return "in_review";
  if (state.event.status === "rejected") return "critical_rejected";
  return "phone_saved";
}
function reviewedKey(state: SampleState): MessageKey | null {
  const review = state.review;
  if (!review || review.source_event_id !== state.event?.envelope.id) return null;
  if (review.effect_state === "applied_review") return "mobile.sample.reviewApplied";
  if (review.effect_state === "discarded") return "mobile.sample.reviewDiscarded";
  return "mobile.sample.reviewObserved";
}
function originLabel(origin: SampleOrigin | null | undefined, locale: Locale): string | null {
  if (!origin) return null;
  return locale === "en" ? origin.label_en : origin.label_es;
}
function photoRequirement(
  original: SampleOrigin | undefined | null,
  current: SampleOrigin | undefined,
): boolean | null {
  if (!original && !current) return null;
  return Boolean(original?.requires_photo || current?.requires_photo);
}
function chosenFacts(state: SampleState, draft: SampleDraft, locale: Locale) {
  const current = state.origins.find(({ code }) => code === draft.originCode);
  const origin = draft.origin?.code === draft.originCode ? draft.origin : current;
  const method =
    draft.method?.id === draft.methodVersion
      ? draft.method
      : state.methods.find(({ id }) => id === draft.methodVersion);
  return {
    isOther: origin?.is_other ?? false,
    originLabel: originLabel(origin, locale),
    methodLabel: method?.label ?? null,
    requiresPhoto: photoRequirement(origin, current),
  };
}
const EMPTY_FIELDS = {
  sampleId: null,
  sourceId: null,
  sourceLabel: null,
  sourceKindKey: null,
  code: "",
  otherText: "",
  isOther: false,
  originLabel: null,
  methodLabel: null,
  requiresPhoto: null,
  evidenceCount: 0,
  photoUri: null,
  gpsAccuracy: null,
};
function captureFields(state: SampleState, locale: Locale) {
  const draft = state.draft;
  if (!draft) return EMPTY_FIELDS;
  return {
    sampleId: draft.sampleId,
    sourceId: draft.sourceRef.id,
    sourceLabel: draft.source.label,
    sourceKindKey: SOURCE_KEYS[draft.sourceRef.kind],
    code: draft.code,
    otherText: draft.otherText,
    ...chosenFacts(state, draft, locale),
    evidenceCount: draft.evidence.length,
    photoUri: draft.evidence.at(-1)?.fileRef ?? null,
    gpsAccuracy: draft.gps?.accuracy_m ?? null,
  };
}
function receiptAt(state: SampleState): string | null {
  const draft = state.draft,
    receipt = state.receipt;
  return draft &&
    state.event &&
    receipt?.sample_id.toLowerCase() === draft.sampleId.toLowerCase() &&
    receipt.event_id.toLowerCase() === draft.eventId.toLowerCase()
    ? receipt.received_at
    : null;
}
function captureOutcome(state: SampleState) {
  return {
    status: captureStatus(state),
    evidencePending: state.evidencePending,
    resultKey: resultMessageKey(state.event?.result ?? null),
    reviewedKey: reviewedKey(state),
    receiptAt: receiptAt(state),
    blockers: [...new Set(state.gates.map(sampleGateKey))],
  };
}
function canSaveForm(input: {
  readonly state: SampleState;
  readonly snapshot: SampleEditorSnapshot;
  readonly hasPendingEdits: boolean;
}): boolean {
  return (
    input.state.ready &&
    input.state.draft !== null &&
    input.state.event === null &&
    input.state.gates.length === 0 &&
    !input.hasPendingEdits &&
    !input.snapshot.isBusy &&
    input.snapshot.errorKey === null
  );
}
function formState(snapshot: SampleEditorSnapshot, controller: SampleEditorController) {
  const state = snapshot.state ?? EMPTY;
  const hasPendingEdits = controller.hasPending() || snapshot.isValidating,
    draft = state.draft;
  const isTouched = draft !== null && draft.sampleId === snapshot.touchedId;
  return {
    hasDraft: draft !== null,
    canBegin: state.canBegin,
    canEdit: state.ready && draft !== null && state.event === null,
    canSave: canSaveForm({ state, snapshot, hasPendingEdits }),
    hasPendingEdits,
    codeErrorKey:
      isTouched && state.gates.includes("code") ? ("mobile.sample.codeRequired" as const) : null,
    otherErrorKey:
      isTouched && state.gates.includes("other") ? ("mobile.sample.otherRequired" as const) : null,
  };
}
function editorActions(controller: SampleEditorController, state: SampleState) {
  return {
    changeCode: (code: string) => {
      controller.edit({ code });
    },
    changeOtherText: (otherText: string) => {
      controller.edit({ otherText });
    },
    selectMethod: (methodVersion: string) => {
      controller.edit({ methodVersion });
    },
    selectOrigin: (originCode: string) => {
      const origin = state.origins.find(({ code }) => code === originCode);
      controller.edit({ originCode, ...(origin?.is_other ? {} : { otherText: "" }) });
    },
    selectSource: (key: string) => {
      const source = state.sources.find(({ kind, id }) => `${kind}:${id}` === key);
      if (source) controller.chooseSource({ kind: source.kind, id: source.id });
    },
    openDraft: controller.openDraft,
    begin: controller.begin,
    blurFields: controller.blurFields,
    acquireGps: controller.locate,
    capturePhoto: controller.photo,
    undoPhoto: controller.undoPhoto,
    save: controller.save,
    retry: controller.retry,
  };
}
function workLabel(work: SampleWork, t: ReturnType<typeof useT>): string {
  const status = t(STATUS_KEYS[work.status]);
  const reminder =
    work.status === "draft"
      ? ""
      : t(work.receiptAt ? "mobile.sample.received" : "mobile.sample.deliveryPending");
  return [work.code || work.sampleId, status, reminder].filter(Boolean).join(" · ");
}
function choices(input: {
  readonly state: SampleState;
  readonly selection: SampleSelection;
  readonly t: ReturnType<typeof useT>;
  readonly locale: Locale;
}) {
  const { state, selection, t, locale } = input;
  const source = state.draft?.sourceRef ?? selection.sourceRef;
  return {
    sources: state.sources.map(({ kind, id, label }) => ({
      id: `${kind}:${id}`,
      label: `${t(SOURCE_KEYS[kind])} · ${label}`,
    })),
    origins: state.origins.map((origin) => ({
      id: origin.code,
      label: locale === "en" ? origin.label_en : origin.label_es,
    })),
    methods: state.methods.map(({ id, label }) => ({ id, label })),
    drafts: state.work.map((work) => ({ id: work.sampleId, label: workLabel(work, t) })),
    selectedSource: source ? `${source.kind}:${source.id}` : null,
    selectedOrigin: state.draft?.originCode || null,
    selectedMethod: state.draft?.methodVersion || null,
  };
}
function useSampleNavigation() {
  const { push } = useNavigation();
  return {
    openInbox: () => {
      push({ name: "inbox" });
    },
    backToDay: () => {
      push({ name: "day" });
    },
  };
}
export function useSamples(selection: SampleSelection): SampleViewModel {
  const { controller, snapshot } = useSampleEditor(selection);
  const t = useT(),
    locale = useLocale(),
    navigation = useSampleNavigation();
  const state = snapshot.state ?? EMPTY;
  return {
    ...captureFields(state, locale),
    ...captureOutcome(state),
    ...choices({ state, selection: snapshot.selection, t, locale }),
    ...formState(snapshot, controller),
    ...editorActions(controller, state),
    ...navigation,
    isLoading: snapshot.state === null && snapshot.errorKey === null,
    isBusy: snapshot.isBusy,
    errorKey: snapshot.errorKey,
  };
}
