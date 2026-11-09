import { useState } from "react";
import { validateFuel } from "../src/features/fuel/domain.ts";
import { fuelErrorKey } from "../src/features/fuel/fuel-error-key.ts";

const DRAFT = {
  eventId: "00000000-0000-4000-8000-000000000140",
  ownerKey: "synthetic-browser-owner",
  shiftId: "00000000-0000-4000-8000-000000000141",
  motorcycleCode: "M-03",
  deviceTime: "2026-11-09T12:00:00Z",
  catalogVersion: "synthetic-catalog",
  rulesVersion: "synthetic-rules",
  litres: "4.5",
  amount: "108",
  currency: "MXN",
  odometer: "12512",
  isFullRefill: false,
  receipt: null,
};
const INSUFFICIENT = {
  kind: "insufficient",
  efficiencyKmL: null,
  minimum: null,
  maximum: null,
};

// Explicit synthetic camera boundary: no native request, bytes or captured-evidence reference.
const cancelledPhotoPort = { capture: () => Promise.resolve(null) };

/** In-memory fixture only. Save exercises real validation without claiming durable capture. */
export function useFuelPreviewModel() {
  const [draft, setDraft] = useState(DRAFT);
  const [submittedId, setSubmitted] = useState(null);
  const [errorKey, setError] = useState(null);
  const [previewHint, setHint] = useState("");
  const refresh = () => Promise.resolve();
  const run = async (action) => {
    setError(null);
    try {
      await action();
    } catch (error) {
      setError(fuelErrorKey(error));
    }
  };
  const photo = async () => {
    await cancelledPhotoPort.capture();
    setHint(
      "Synthetic camera cancellation: no evidence captured. All entered fields remain unchanged.",
    );
  };
  const save = () => {
    setSubmitted(draft.eventId);
    void run(() => {
      validateFuel(draft);
      setHint("Preview validation passed. Nothing was written to a database or sent to a server.");
    });
  };
  const state = {
    ready: true,
    canBegin: true,
    draft,
    drafts: [draft],
    event: null,
    receiptPending: true,
    review: null,
    advisory: INSUFFICIENT,
  };
  return {
    state,
    errorKey,
    isBusy: false,
    hasPending: true,
    submittedId,
    refresh,
    run,
    save,
    previewHint,
    edit: (field, value) => {
      setDraft((current) => ({ ...current, [field]: value }));
    },
    service: {
      photo,
      begin: () => {
        setDraft(DRAFT);
        return refresh();
      },
    },
  };
}
