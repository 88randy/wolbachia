import { useRef, useState } from "react";
import type { Schemas } from "@wolbachia/api-client";
import type { Count, LabScope } from "./lab-query";
import { countValue } from "./count-value";
import { commandId, writeLabStored } from "./lab-storage";
import { useLabText } from "./use-lab-text";
import { useLabWrite } from "./use-lab-write";
import { countCharacters, hasForbiddenCharacters, normalizeReason } from "../void/count-characters";
export interface CorrectionOptions {
  scope: LabScope;
  count: Count;
  revision: number;
  storageKey: string;
  onSaved: () => void;
  onBusyChange: (busy: boolean) => void;
}
function useCorrectionDraft(storageKey: string) {
  const [reasonCode, setCode] = useLabText(storageKey + ":code");
  const [reason, setReason] = useLabText(storageKey + ":reason");
  const [value, setValue] = useLabText(storageKey + ":value");
  const [isInvalid, setInvalid] = useState(false);
  const [hasReasonError, setReasonError] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return {
    reasonCode,
    setCode,
    reason,
    setReason,
    value,
    setValue,
    isInvalid,
    hasReasonError,
    input,
    setInvalid,
    setReasonError,
    validateCount: () => {
      setInvalid(countValue(value) === undefined);
    },
  };
}
function isValidReason(reason: string, code: string) {
  return (
    code !== "" &&
    countCharacters(reason) >= 10 &&
    Array.from(reason).length <= 1000 &&
    !hasForbiddenCharacters(reason)
  );
}
interface CorrectionSubmission {
  options: CorrectionOptions;
  draft: ReturnType<typeof useCorrectionDraft>;
  write: ReturnType<typeof useLabWrite>;
  confirmed: boolean;
}
async function submitCorrection({ options, draft, write, confirmed }: CorrectionSubmission) {
  const parsed = countValue(draft.value);
  const normalized = normalizeReason(draft.reason);
  draft.setInvalid(parsed === undefined);
  const isReasonValid = isValidReason(normalized, draft.reasonCode);
  draft.setReasonError(!isReasonValid);
  if (parsed === undefined) {
    draft.input.current?.focus();
    return;
  }
  if (!isReasonValid) return;
  const body = correctionBody(options, {
    reason_code: draft.reasonCode,
    reason: normalized,
    replacement: { kind: "count", value: parsed, confirmed_implausible: confirmed },
  });
  const result =
    write.failure?.kind === "uncertain"
      ? await write.retry()
      : await write.send({ kind: "void", id: options.count.id, body });
  if (!result) return;
  for (const suffix of [":code", ":reason", ":value", ":command"])
    writeLabStored(options.storageKey + suffix, null);
  options.onSaved();
}
/** Corrections require a canonical reason and a visible note for every reason code. */
export function useCorrectionForm(options: CorrectionOptions) {
  const draft = useCorrectionDraft(options.storageKey);
  const write = useLabWrite(options.scope, options.onBusyChange);
  return {
    ...draft,
    write,
    submit: (confirmed = false) => submitCorrection({ options, draft, write, confirmed }),
  };
}
function correctionBody(
  options: CorrectionOptions,
  values: Pick<Schemas["LabVoidRequest"], "reason" | "reason_code" | "replacement">,
): Schemas["LabVoidRequest"] {
  const facts = { ...values, expected_revision: options.revision };
  return {
    ...facts,
    command_id: commandId(options.storageKey + ":command", JSON.stringify(facts)),
  };
}
