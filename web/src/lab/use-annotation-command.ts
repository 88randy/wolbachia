import { useState } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { countCharacters, hasForbiddenCharacters, normalizeReason } from "../void/count-characters";
import { buildAnnotationCount, buildAnnotationReplacement } from "./annotation-command";
import type { AnnotationCountOptions } from "./annotation-command";
import type { LabScope } from "./lab-query";
import { writeLabStored } from "./lab-storage";
import { useLabWrite } from "./use-lab-write";
import type { LabCommand } from "./use-lab-write";
import { useLabText } from "./use-lab-text";
export interface AnnotationTarget {
  bagId: string;
  code: string;
  revision: number;
  correctionId?: string;
}
interface Options {
  scope: LabScope;
  target: AnnotationTarget;
  storageKey: string;
  onSaved: (outcome: Schemas["LabCountOutcome"]) => void | Promise<void>;
}
interface Submission {
  options: Options;
  draft: ReturnType<typeof useAnnotationReason>;
  write: ReturnType<typeof useLabWrite>;
}
function useAnnotationReason(options: Options) {
  const key =
    "wolbachia:lab:" +
    JSON.stringify([options.scope.identity.userId, options.scope.identity.organizationSlug]) +
    ":correction:" +
    (options.target.correctionId ?? "");
  const reason = useLabText(key + ":reason");
  const code = useLabText(key + ":code");
  const [isReasonInvalid, setReasonInvalid] = useState(false);
  const validReason = () => {
    const text = normalizeReason(reason[0]);
    const valid =
      code[0] !== "" &&
      countCharacters(text) >= 10 &&
      Array.from(text).length <= 1000 &&
      !hasForbiddenCharacters(text);
    setReasonInvalid(!valid);
    return valid;
  };
  return { key, reason, code, isReasonInvalid, validReason };
}
async function submitAnnotation(
  context: Submission,
  payload: AnnotationCountOptions,
  confirmed: boolean,
) {
  const { options, draft, write } = context;
  if (options.target.correctionId && !draft.validReason()) return;
  const result =
    write.failure?.kind === "uncertain"
      ? await write.retry()
      : await write.send(annotationLabCommand(context, payload, confirmed));
  if (!result?.count) return;
  for (const suffix of [":code", ":reason", ":value", ":command"])
    writeLabStored(draft.key + suffix, null);
  for (const suffix of [":command", ":replacement-command"])
    writeLabStored(options.storageKey + suffix, null);
  await options.onSaved({
    count: result.count,
    next_bag: result.next_bag,
    queue_snapshot: result.queue_snapshot,
  });
}
export function useAnnotationCommand(options: Options) {
  const draft = useAnnotationReason(options);
  const write = useLabWrite(options.scope);
  return {
    ...draft,
    write,
    submit: (payload: AnnotationCountOptions, confirmed: boolean) =>
      submitAnnotation({ options, draft, write }, payload, confirmed),
  };
}

function annotationLabCommand(
  context: Submission,
  payload: AnnotationCountOptions,
  confirmed: boolean,
): LabCommand {
  const { options, draft } = context;
  return options.target.correctionId
    ? {
        kind: "void",
        id: options.target.correctionId,
        body: buildAnnotationReplacement(
          payload,
          {
            id: options.target.correctionId,
            reason: normalizeReason(draft.reason[0]),
            code: draft.code[0],
          },
          confirmed,
        ),
      }
    : {
        kind: "count",
        id: options.target.bagId,
        body: buildAnnotationCount(payload, confirmed),
      };
}
