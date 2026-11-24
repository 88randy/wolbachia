import type { Schemas } from "@wolbachia/api-client";
import type { AnnotationMark } from "./annotation-state";
import { commandId } from "./lab-storage";

export interface AnnotationCountOptions {
  storageKey: string;
  revision: number;
  context: Schemas["LabQueueQueryRequest"];
  uploadId: string;
  marks: AnnotationMark[];
}

/** Value and geometry are frozen together; identical explicit replay keeps its command UUID. */
export function buildAnnotationCount(
  options: AnnotationCountOptions,
  confirmed: boolean,
): Schemas["CountWriteRequest"] {
  const facts = {
    value: options.marks.length,
    expected_revision: options.revision,
    queue_context: options.context,
    confirmed_implausible: confirmed,
    annotation: {
      upload_id: options.uploadId,
      marks: options.marks,
      tool_version: "aedesvision-web-1",
    },
  };
  return {
    ...facts,
    command_id: commandId(options.storageKey + ":command", JSON.stringify(facts)),
  };
}

export function buildAnnotationReplacement(
  options: AnnotationCountOptions,
  correction: { id: string; reason: string; code: string },
  confirmed: boolean,
): Schemas["LabVoidRequest"] {
  const count = buildAnnotationCount(options, confirmed);
  const facts = {
    expected_revision: options.revision,
    reason: correction.reason,
    reason_code: correction.code,
    replacement: {
      kind: "count" as const,
      value: count.value,
      confirmed_implausible: confirmed,
      annotation: count.annotation,
    },
  };
  return {
    ...facts,
    command_id: commandId(options.storageKey + ":replacement-command", JSON.stringify(facts)),
  };
}
