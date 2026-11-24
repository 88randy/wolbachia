import type { Schemas } from "@wolbachia/api-client";
import type { AnnotationMark } from "./annotation-state";
import { commandId } from "./lab-storage";

export const ANNOTATION_TOOL_VERSION = "aedesvision-web-1";

export interface AnnotationCountOptions {
  storageKey: string;
  revision: number;
  context: Schemas["LabQueueQueryRequest"];
  uploadId: string;
  marks: AnnotationMark[];
  elapsedSeconds: number;
}

/** Value and geometry are frozen together; identical explicit replay keeps its command UUID. */
export function buildAnnotationCount(
  options: AnnotationCountOptions,
  confirmed: boolean,
): Schemas["CountWriteRequest"] {
  const facts = annotationCountFacts(options, confirmed);
  return {
    ...facts,
    command_id: commandId(options.storageKey + ":command", JSON.stringify(facts)),
  };
}

function annotationCountFacts(options: AnnotationCountOptions, confirmed: boolean) {
  return {
    value: options.marks.length,
    expected_revision: options.revision,
    queue_context: options.context,
    confirmed_implausible: confirmed,
    annotation: {
      upload_id: options.uploadId,
      marks: options.marks,
      tool_version: ANNOTATION_TOOL_VERSION,
      elapsed_seconds: options.elapsedSeconds,
    },
  };
}

export function buildAnnotationReplacement(
  options: AnnotationCountOptions,
  correction: { id: string; reason: string; code: string },
  confirmed: boolean,
): Schemas["LabVoidRequest"] {
  const count = annotationCountFacts(options, confirmed);
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
