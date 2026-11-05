import { useState } from "react";
import type { SyntheticEvent } from "react";
import type { VoidResult } from "./submit-void";
import { useVoidRequest } from "./use-void-request";
import type { VoidLimits } from "./void-limits";
import { useVoidReasons } from "./use-void-reasons";
import { sendOtherChoice, useVoidText } from "./use-void-text";

export interface VoidChoice {
  reasonCode: string;
  reason: string;
}

interface VoidFormOptions {
  limits: VoidLimits;
  submit: (choice: VoidChoice) => Promise<VoidResult>;
  onVoided: () => void;
}

function useReasonSelection() {
  const [reasonCode, setReasonCode] = useState("");
  const [hasSelectionError, setSelectionError] = useState(false);
  return {
    reasonCode,
    hasSelectionError,
    clearSelection: () => {
      setReasonCode("");
    },
    requireSelection: () => {
      setSelectionError(true);
    },
    chooseReason: (code: string) => {
      setReasonCode(code);
      setSelectionError(false);
    },
  };
}

interface FormActionsOptions {
  catalog: ReturnType<typeof useVoidReasons>;
  selection: ReturnType<typeof useReasonSelection>;
  text: ReturnType<typeof useVoidText>;
  request: ReturnType<typeof useVoidRequest>;
}

function handleChoiceSubmit(event: SyntheticEvent, options: FormActionsOptions) {
  event.preventDefault();
  const { catalog, selection, text, request } = options;
  if (request.status.kind === "busy" || catalog.isCatalogBlocked) return;
  const selected = catalog.items.find((item) => item.code === selection.reasonCode);
  if (selected === undefined) {
    selection.requireSelection();
    return;
  }
  const choice = { reasonCode: selected.code, reason: selected.is_other ? text.normalized : "" };
  if (selected.is_other) sendOtherChoice(request, choice, text.minLength);
  else void request.send(choice);
}

function formActions(options: FormActionsOptions) {
  const { catalog, selection, request } = options;
  return {
    isOther: catalog.items.find((item) => item.code === selection.reasonCode)?.is_other === true,
    isBusy: request.status.kind === "busy",
    handleSubmit: (event: SyntheticEvent) => {
      handleChoiceSubmit(event, options);
    },
    chooseReason: (code: string) => {
      if (request.status.kind === "busy") return;
      selection.chooseReason(code);
      request.reset();
    },
  };
}

/** Catalog selection and Other's free-text validation share one submit boundary. */
export function useVoidForm({ limits, submit, onVoided }: VoidFormOptions) {
  const catalog = useVoidReasons();
  const selection = useReasonSelection();
  const request = useVoidRequest(submit, onVoided, () => {
    selection.clearSelection();
    catalog.refreshCatalog();
  });
  const text = useVoidText(limits, request);
  return {
    ...catalog,
    ...selection,
    ...text,
    ...formActions({ catalog, selection, text, request }),
  };
}

export type VoidForm = ReturnType<typeof useVoidForm>;
