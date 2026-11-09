import { useEffect, useRef, useState } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { countValue } from "./count-value";
import { commandId, readLabStored, writeLabStored } from "./lab-storage";
import { useLabWrite } from "./use-lab-write";
import type { Candidate, LabScope } from "./lab-query";
interface CountFormOptions {
  scope: LabScope; bag: Candidate; storageKey: string;
  context: Schemas["LabQueueQueryRequest"];
  onSaved: (outcome: Schemas["LabCountOutcome"]) => void;
}
/** Keep the authored value until a confirmed result; retry an uncertain command unchanged. */
export function useCountForm(options: CountFormOptions) {
  const [value, setValue] = useState(() => readLabStored(options.storageKey) ?? "");
  const [isRestored, setRestored] = useState(value !== "");
  const [isInvalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const write = useLabWrite(options.scope);
  useEffect(() => { input.current?.focus(); }, []);
  const change = (next: string) => {
    setValue(next); writeLabStored(options.storageKey, next); write.clearFailure();
    if (isInvalid) setInvalid(countValue(next) === undefined);
  };
  const submit = async (confirmed = false) => {
    if (write.failure?.kind === "confirm" && !confirmed) return;
    const parsed = countValue(value);
    if (parsed === undefined) { setInvalid(true); input.current?.focus(); return; }
    const outcome = write.failure?.kind === "uncertain" ? await write.retry() : await write.send({ kind: "count", id: options.bag.id, body: buildCountBody(options, parsed, confirmed) });
    if (!outcome || !outcome.count) { input.current?.focus(); return; }
    writeLabStored(options.storageKey, null);
    writeLabStored(options.storageKey + ":command", null);
    options.onSaved({ ...outcome, count: outcome.count });
  };
  return { validate: () => { setInvalid(countValue(value) === undefined); }, value, change, input, isRestored, isInvalid, write, submit,
    discard: () => { change(""); setRestored(false); input.current?.focus(); } };
}
function buildCountBody(options: CountFormOptions, value: number, confirmed: boolean): Schemas["CountWriteRequest"] {
  const facts = { value, confirmed_implausible: confirmed, expected_revision: options.bag.expected_revision, queue_context: options.context };
  return { ...facts, command_id: commandId(options.storageKey + ":command", JSON.stringify(facts)) };
}
