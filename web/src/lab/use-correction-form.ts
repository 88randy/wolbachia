import { useRef, useState } from "react";
import type { Schemas } from "@wolbachia/api-client";
import type { Count, LabScope } from "./lab-query";
import { countValue } from "./count-value";
import { commandId, writeLabStored } from "./lab-storage";
import { useLabText } from "./use-lab-text";
import { useLabWrite } from "./use-lab-write";
import { countCharacters, hasForbiddenCharacters, normalizeReason } from "../void/count-characters";
export interface CorrectionOptions { scope: LabScope; count: Count; revision: number; storageKey: string; onSaved: () => void; onBusyChange: (busy: boolean) => void }
/** Corrections require a canonical reason and a visible note for every reason code. */
export function useCorrectionForm(options: CorrectionOptions) {
  const [reasonCode, setCode] = useLabText(options.storageKey + ":code");
  const [reason, setReason] = useLabText(options.storageKey + ":reason");
  const [value, setValue] = useLabText(options.storageKey + ":value");
  const [isInvalid, setInvalid] = useState(false);
  const [hasReasonError, setReasonError] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const write = useLabWrite(options.scope, options.onBusyChange);
  const submit = async (confirmed = false) => {
    const parsed = countValue(value);
    const normalized = normalizeReason(reason);
    setInvalid(parsed === undefined);
    const isReasonValid = reasonCode !== "" && countCharacters(normalized) >= 10 && Array.from(normalized).length <= 1000 && !hasForbiddenCharacters(normalized);
    setReasonError(!isReasonValid);
    if (parsed === undefined) { input.current?.focus(); return; }
    if (!isReasonValid) return;
    const body = correctionBody(options, { reason_code: reasonCode, reason: normalized, replacement: { kind: "count", value: parsed, confirmed_implausible: confirmed } });
    const result = write.failure?.kind === "uncertain" ? await write.retry() : await write.send({ kind: "void", id: options.count.id, body });
    if (!result) return;
    for (const suffix of [":code", ":reason", ":value", ":command"]) writeLabStored(options.storageKey + suffix, null);
    options.onSaved();
  };
  return { validateCount: () => { setInvalid(countValue(value) === undefined); }, reasonCode, setCode, reason, setReason, value, setValue, isInvalid, hasReasonError, input, write, submit };
}
function correctionBody(options: CorrectionOptions, values: Pick<Schemas["LabVoidRequest"], "reason" | "reason_code" | "replacement">): Schemas["LabVoidRequest"] {
  const facts = { ...values, expected_revision: options.revision };
  return { ...facts, command_id: commandId(options.storageKey + ":command", JSON.stringify(facts)) };
}
