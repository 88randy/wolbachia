import { AnnotationCorrectionFields } from "./AnnotationCorrectionFields";
import type { AnnotationWorkspaceState } from "./use-annotation-workspace";
export function AnnotationCorrectionContext({
  workspace,
}: {
  workspace: AnnotationWorkspaceState;
}) {
  const { command, target } = workspace;
  return target.correctionId ? (
    <AnnotationCorrectionFields
      reason={command.reason}
      code={command.code}
      isInvalid={command.isReasonInvalid}
      isLocked={command.write.isBusy || command.write.failure?.kind === "uncertain"}
    />
  ) : null;
}
