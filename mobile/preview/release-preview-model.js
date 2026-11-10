import { useState } from "react";
import { quantityUnits } from "../src/features/releases/domain.ts";
import { RELEASE_GATE_NAMES } from "../src/features/releases/view-model.ts";

const DEVICE_ID = "00000000-0000-4000-8000-000000000139";
const TASK_ID = "00000000-0000-4000-8000-000000000140";
const PERMIT_ID = "00000000-0000-4000-8000-000000000141";
const LOT_ID = "00000000-0000-4000-8000-000000000142";

function previewGates(input) {
  return RELEASE_GATE_NAMES.map((name) => {
    if (name === "training" && input.isBlocked)
      return {
        name,
        state: "fail",
        detailKey: "mobile.release.detail.trainingBlocked",
        contact: "supervisor",
      };
    if (name === "lot" && input.evidenceCount === 0)
      return {
        name,
        state: "fail",
        detailKey: "mobile.release.detail.evidenceRequired",
        contact: "supervisor",
      };
    if (name === "lot" && !input.isQuantityValid)
      return {
        name,
        state: "fail",
        detailKey: "mobile.release.detail.quantityInvalid",
        contact: "supervisor",
      };
    return { name, state: "pass", contact: name === "gps" ? "courier" : "supervisor" };
  });
}
function previewReferences() {
  return { deviceId: DEVICE_ID, taskId: TASK_ID, permitId: PERMIT_ID, lotId: LOT_ID };
}
function previewActions(setHint) {
  const explain = () => {
    setHint(
      "Synthetic preview action only. No navigation, messages, database or network writes occurred.",
    );
  };
  return {
    begin: explain,
    selectTask: explain,
    selectDevice: explain,
    acquireGps: () => {
      setHint("Synthetic GPS is fixed at ±4 m. No native location request occurred.");
    },
    capturePhoto: () => {
      setHint(
        "Synthetic camera cancellation. No files, bytes or evidence references were created.",
      );
    },
    reportSupervisor: explain,
    reportDevice: explain,
    openInbox: explain,
    goBackToDay: explain,
  };
}
/** A complete synthetic draft, never proof of native capture, storage, authorization or delivery. */
export function useReleasePreviewModel(isBlocked) {
  const [quantity, setQuantity] = useState("2500");
  const [evidenceCount, setEvidenceCount] = useState(1);
  const [previewHint, setHint] = useState("");
  const units = quantityUnits(quantity),
    isQuantityValid = units !== null && units > 0n;
  const gates = previewGates({ isBlocked, evidenceCount, isQuantityValid });
  const canRestart =
    isBlocked && new URLSearchParams(globalThis.location.search).get("restart") === "1";
  const model = {
    isLoading: false,
    isBusy: false,
    errorKey: null,
    refs: previewReferences(),
    taskOptions: [{ id: TASK_ID, code: "RELEASE-139" }],
    deviceOptions: [{ id: DEVICE_ID, code: "RD-139" }],
    selectedTaskId: TASK_ID,
    selectedDeviceId: DEVICE_ID,
    hasDraft: true,
    canBegin: false,
    canRestart,
    restart: () => {
      setHint(
        "Synthetic fresh-draft action only. The original source/evidence remain unchanged; no storage or server write occurred.",
      );
    },
    hasPendingEdits: false,
    quantity,
    quantityErrorKey: null,
    gates,
    canEdit: true,
    canSave: !isBlocked && isQuantityValid && evidenceCount > 0,
    status: "draft",
    resultKey: null,
    reviewedKey: null,
    evidenceCount,
    photoUri: null,
    requiresEvidence: true,
    evidencePending: false,
    gpsAccuracy: 4,
    changeQuantity: setQuantity,
    blurQuantity: () => undefined,
    ...previewActions(setHint),
    undoPhoto: () => {
      setEvidenceCount(0);
      setHint("The synthetic evidence reference was removed from preview memory only.");
    },
    retry: () => {
      setQuantity("2500");
      setEvidenceCount(1);
      setHint("");
    },
    save: () => {
      setHint("Preview validation passed. No release was saved on the phone or sent to a server.");
    },
  };
  return { model, previewHint };
}
