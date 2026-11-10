import { useEffect, useRef, useState } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { countValue } from "./count-value";
import { commandId, writeLabStored } from "./lab-storage";
import { useLabText } from "./use-lab-text";
import { useLabWrite } from "./use-lab-write";
import type { Candidate, LabScope } from "./lab-query";
export interface CountFormOptions {
  scope: LabScope;
  bag: Candidate;
  storageKey: string;
  context: Schemas["LabQueueQueryRequest"];
  onSaved: (outcome: Schemas["LabCountOutcome"]) => void;
}
function useCountDraft(storageKey: string) {
  const [value, setValue] = useLabText(storageKey);
  const [isRestored, setRestored] = useState(value !== "");
  const [isInvalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const change = (next: string) => {
    setValue(next);
    if (isInvalid) setInvalid(countValue(next) === undefined);
  };
  const discard = () => {
    change("");
    setRestored(false);
    input.current?.focus();
  };
  return {
    value,
    input,
    isRestored,
    isInvalid,
    change,
    discard,
    setInvalid,
    validate: () => {
      setInvalid(countValue(value) === undefined);
    },
  };
}
interface CountSubmission {
  options: CountFormOptions;
  draft: ReturnType<typeof useCountDraft>;
  write: ReturnType<typeof useLabWrite>;
  confirmed: boolean;
}
function focusCount(draft: ReturnType<typeof useCountDraft>) {
  draft.input.current?.focus();
}
async function submitCount({ options, draft, write, confirmed }: CountSubmission) {
  if (write.failure?.kind === "confirm" && !confirmed) return;
  const parsed = countValue(draft.value);
  if (parsed === undefined) {
    draft.setInvalid(true);
    focusCount(draft);
    return;
  }
  const outcome =
    write.failure?.kind === "uncertain"
      ? await write.retry()
      : await write.send({
          kind: "count",
          id: options.bag.id,
          body: buildCountBody(options, parsed, confirmed),
        });
  if (!outcome || !outcome.count) {
    focusCount(draft);
    return;
  }
  writeLabStored(options.storageKey, null);
  writeLabStored(options.storageKey + ":command", null);
  options.onSaved({ ...outcome, count: outcome.count });
}
/** Keep the authored value until a confirmed result; retry an uncertain command unchanged. */
export function useCountForm(options: CountFormOptions) {
  const draft = useCountDraft(options.storageKey);
  const write = useLabWrite(options.scope);
  const isLocked =
    write.isBusy || write.failure?.kind === "uncertain" || write.failure?.kind === "conflict";
  const change = (next: string) => {
    draft.change(next);
    write.clearFailure();
  };
  const discard = () => {
    draft.discard();
    write.clearFailure();
  };
  return {
    ...draft,
    isLocked,
    change,
    discard,
    write,
    submit: (confirmed = false) => submitCount({ options, draft, write, confirmed }),
  };
}
function buildCountBody(
  options: CountFormOptions,
  value: number,
  confirmed: boolean,
): Schemas["CountWriteRequest"] {
  const facts = {
    value,
    confirmed_implausible: confirmed,
    expected_revision: options.bag.expected_revision,
    queue_context: options.context,
  };
  return {
    ...facts,
    command_id: commandId(options.storageKey + ":command", JSON.stringify(facts)),
  };
}
