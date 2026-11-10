import { useState } from "react";

const SAMPLE_ID = "00000000-0000-4000-8000-000000000201";
const SOURCE_ID = "00000000-0000-4000-8000-000000000202";
const METHOD_ID = "00000000-0000-4000-8000-000000000203";
const STATUSES = new Set([
  "draft",
  "phone_saved",
  "server_received",
  "in_review",
  "critical_rejected",
]);
function fixtureOptions(isEnglish) {
  return {
    sources: [{ id: `lot:${SOURCE_ID}`, label: "LOT-139" }],
    origins: [
      {
        id: "adult-trap",
        label: isEnglish ? "Adult trap (synthetic)" : "Trampa de adultos (sintética)",
      },
      { id: "other", label: isEnglish ? "Other (synthetic)" : "Otro (sintético)" },
    ],
    methods: [
      {
        id: METHOD_ID,
        label: isEnglish
          ? "Named verified method (synthetic)"
          : "Método nombrado verificado (sintético)",
      },
    ],
  };
}
function fixtureActions(setHint) {
  const explain = () => {
    setHint(
      "Synthetic preview action only. No database, outbox, API, files or native activity occurred.",
    );
  };
  return {
    selectSource: explain,
    selectMethod: explain,
    acquireGps: explain,
    retry: explain,
    openInbox: explain,
    backToDay: explain,
    blurFields: () => undefined,
    capturePhoto: () => {
      setHint("Synthetic camera cancellation; no evidence bytes or references were created.");
    },
    save: () => {
      setHint(
        "Preview only: no sample was saved on a phone, sent to a server or received by a lab.",
      );
    },
  };
}
function fixtureOutcome(parameters) {
  const requested = parameters.get("status");
  const status = STATUSES.has(requested) ? requested : "draft";
  return {
    status,
    evidencePending: status === "phone_saved",
    resultKey: null,
    reviewedKey: null,
    receiptAt:
      status !== "draft" && parameters.get("received") === "1" ? "2026-11-10T18:00:00Z" : null,
  };
}
function isSaveable({ code, origin, otherText, evidenceCount }) {
  const isCodeValid = code.trim().length > 0 && code.trim().length <= 50;
  const isOriginValid = origin !== "other" || otherText.trim().length > 0;
  return isCodeValid && isOriginValid && evidenceCount > 0;
}
export function useSamplePreviewModel() {
  const parameters = new URLSearchParams(globalThis.location.search);
  const [code, setCode] = useState("M-2207");
  const [otherText, setOtherText] = useState("Configured source detail");
  const [origin, setOrigin] = useState("other");
  const [evidenceCount, setEvidenceCount] = useState(1);
  const [hasDraft, setDraft] = useState(parameters.get("entry") !== "1");
  const [previewHint, setHint] = useState("");
  const isBlocked = parameters.get("blocked") === "1";
  const isEmpty = parameters.get("empty") === "1";
  const options = fixtureOptions(parameters.get("lang") === "en");
  const outcome = fixtureOutcome(parameters);
  const blockers = isBlocked || isEmpty ? ["mobile.sample.configurationUnavailable"] : [];
  const canSave = !isBlocked && !isEmpty && isSaveable({ code, origin, otherText, evidenceCount });
  const model = {
    isLoading: false,
    isBusy: false,
    errorKey: null,
    hasDraft,
    canBegin: !isBlocked && !isEmpty,
    canEdit: outcome.status === "draft",
    canSave,
    hasPendingEdits: false,
    ...options,
    ...(isEmpty ? { sources: [], origins: [], methods: [] } : {}),
    drafts: [{ id: SAMPLE_ID, label: "M-2207 · synthetic saved sample · lab receipt unknown" }],
    selectedSource: `lot:${SOURCE_ID}`,
    selectedOrigin: origin,
    selectedMethod: METHOD_ID,
    sampleId: hasDraft ? SAMPLE_ID : null,
    sourceId: SOURCE_ID,
    sourceLabel: "LOT-139",
    sourceKindKey: "mobile.sample.sourceLot",
    methodLabel: options.methods[0].label,
    originLabel: options.origins.find(({ id }) => id === origin).label,
    code,
    otherText,
    isOther: origin === "other",
    codeErrorKey: null,
    otherErrorKey: null,
    blockers,
    gpsAccuracy: 4,
    requiresPhoto: true,
    evidenceCount,
    photoUri: null,
    ...outcome,
    ...fixtureActions(setHint),
    changeCode: setCode,
    changeOtherText: setOtherText,
    selectOrigin: (value) => {
      setOrigin(value);
      if (value !== "other") setOtherText("");
    },
    undoPhoto: () => {
      setEvidenceCount(0);
      setHint("Synthetic reference removed from preview memory only.");
    },
    begin: () => {
      setDraft(true);
      setHint("Synthetic draft shown in preview memory only; nothing persisted.");
    },
    openDraft: () => {
      setDraft(true);
      setHint("Synthetic own work restored in preview memory only.");
    },
  };
  return { model, previewHint };
}
