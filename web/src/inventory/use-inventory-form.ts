import { useState } from "react";
import { useInventoryDraft } from "./use-inventory-draft";
import { inventoryValuesOf } from "./inventory-form-values";
import { useInventoryWrite } from "./use-inventory-write";
import { supplyPayload } from "./supplies/supply-schema";
import { lotPayload } from "./lots/lot-schema";
import { locationPayload } from "./locations/location-schema";
import type { InventoryKind, InventoryRecord } from "./inventory-links";
import type { InventoryValues } from "./inventory-fields";
import type { InventoryFormCommand } from "./inventory-write";
import type { RetainedAttempt } from "./use-inventory-draft";
import { useInventoryContext } from "./use-inventory-context";
import { UNCERTAIN_WRITE } from "./inventory-failure";
import { useInventoryReconciliation } from "./use-inventory-reconciliation";
import { useRetryWindow } from "../quadrants/geography/use-retry-window";
import { inventoryRouteScope } from "./inventory-query";
interface Options {
  kind: InventoryKind;
  record?: InventoryRecord;
  onSaved: (record: InventoryRecord) => void;
  isVerifying?: boolean;
}
const bodies = {
  supplies: (values: InventoryValues, previous?: InventoryRecord) =>
    supplyPayload(values, previous && "protocol" in previous ? previous : undefined),
  lots: (values: InventoryValues, previous?: InventoryRecord) =>
    lotPayload(values, previous && "supply_version" in previous ? previous : undefined),
  locations: (values: InventoryValues, previous?: InventoryRecord) =>
    locationPayload(values, previous && "geometry" in previous ? previous : undefined),
};
function formCommand(
  kind: InventoryKind,
  values: InventoryValues,
  previous?: InventoryRecord,
): InventoryFormCommand {
  const id = previous?.id;
  const target = id ? { id } : {};
  if (kind === "supplies")
    return { kind: "supply", ...target, body: bodies.supplies(values, previous) };
  if (kind === "lots") return { kind: "lot", ...target, body: bodies.lots(values, previous) };
  return { kind: "location", ...target, body: bodies.locations(values, previous) };
}
interface Actions extends Options {
  retained: ReturnType<typeof useInventoryDraft>;
  write: ReturnType<typeof useInventoryWrite>;
  origin: Pick<ReturnType<typeof useInventoryContext>, "base" | "context" | "isCurrentRead">;
}
function acceptSaved(state: Actions, saved: InventoryRecord, attempt?: RetainedAttempt) {
  if (attempt && state.retained.read().attempt !== attempt) return;
  state.retained.setDraft(
    state.record ? { values: inventoryValuesOf(saved), reviewed: saved } : { values: {} },
  );
  if (state.origin.isCurrentRead()) {
    state.write.clearFailure();
    state.onSaved(saved);
  }
}
async function submitDraft(state: Actions, invalid: (value: boolean) => void) {
  if (!state.origin.isCurrentRead()) return;
  invalid(false);
  let command: InventoryFormCommand;
  try {
    command = formCommand(state.kind, state.retained.draft.values, state.retained.draft.reviewed);
  } catch {
    invalid(true);
    return;
  }
  const attempt = {
    command: structuredClone(command),
    base: state.origin.base,
    context: state.origin.context,
  };
  state.retained.setDraft((draft) => ({ ...draft, attempt, failure: UNCERTAIN_WRITE }));
  const saved = await state.write.send(attempt.command);
  if (saved) acceptSaved(state, saved, attempt);
}
function changeValue(state: Actions, name: string, value: string) {
  if (!state.origin.isCurrentRead()) return;
  state.retained.setDraft((draft) => ({ ...draft, values: { ...draft.values, [name]: value } }));
}
function useFormActions(state: Actions) {
  const { retained, write } = state;
  const [invalid, setInvalid] = useState(false);
  const confirmation = useInventoryReconciliation(state.kind, (saved, attempt) => {
    acceptSaved(state, saved, attempt);
  });
  const failure = retained.draft.failure ?? write.failure;
  const cooling = useRetryWindow(failure?.retryAt ?? 0);
  const submit = async () => {
    if (state.isVerifying || write.isBusy || cooling || failure?.conflict || failure?.uncertain)
      return;
    await submitDraft(state, setInvalid);
  };
  return {
    invalid,
    failure,
    cooling,
    isChecking: confirmation.isChecking,
    setValue: (name: string, value: string) => {
      changeValue(state, name, value);
    },
    submit,
    review: () => {
      reviewCurrent(state);
    },
    reconcile: () => {
      if (state.origin.isCurrentRead()) return confirmation.reconcile(retained.draft);
    },
  };
}
function reviewCurrent({ retained, write, record }: Actions) {
  if (!record) return;
  retained.setDraft((draft) => ({ values: draft.values, reviewed: record }));
  write.clearFailure();
}
export function useInventoryForm(options: Options) {
  const { kind, record } = options;
  const code = record?.code ?? (kind === "lots" ? "new" : undefined);
  const { base, context, isCurrentRead } = inventoryRouteScope(useInventoryContext(), kind, code);
  const retained = useInventoryDraft(kind + ":" + (record?.id ?? "new"), {
    values: inventoryValuesOf(record),
    ...(record ? { reviewed: record } : {}),
  });
  const write = useInventoryWrite(
    (failure, command) => {
      const attempt = retained.read().attempt;
      if (attempt?.command === command)
        retained.updateAttempt(attempt, (draft) => ({ ...draft, failure }));
    },
    { kind, ...(code ? { code } : {}) },
  );
  const actions = useFormActions({
    ...options,
    retained,
    write,
    origin: { base, context, isCurrentRead },
  });
  return { ...write, ...actions, values: retained.draft.values, reviewed: retained.draft.reviewed };
}
