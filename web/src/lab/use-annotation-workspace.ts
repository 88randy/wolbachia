import { useState } from "react";
import type { Schemas } from "@wolbachia/api-client";
import type { LabScope } from "./lab-query";
import type { AnnotationTarget } from "./use-annotation-command";
import { useAnnotationCommand } from "./use-annotation-command";
import { useAnnotationEditor } from "./use-annotation-editor";
import { useAnnotationNavigation } from "./use-annotation-navigation";
export interface AnnotationWorkspaceProps {
  scope: LabScope;
  target: AnnotationTarget;
  context: Schemas["LabQueueQueryRequest"];
  onSaved: (outcome: Schemas["LabCountOutcome"]) => void;
}
/** Freeze the reviewed CAS target across background refreshes, just like numeric W35. */
export function useAnnotationWorkspace(props: AnnotationWorkspaceProps) {
  const { scope, context } = props;
  const [target] = useState(props.target);
  const storageKey =
    "aedesvision:annotation:" +
    JSON.stringify([
      props.scope.identity.userId,
      props.scope.identity.organizationSlug,
      target.code,
      target.correctionId ?? "new",
    ]);
  const editor = useAnnotationEditor(props.scope, storageKey);
  const navigation = useAnnotationNavigation(
    Boolean(editor.original) || editor.state.marks.length > 0,
  );
  const command = useAnnotationCommand({
    ...props,
    target,
    storageKey,
    onSaved: async (outcome) => {
      await editor.draft.save(null);
      navigation.markSaved();
      props.onSaved(outcome);
    },
  });
  return { scope, target, context, storageKey, editor, command, navigation };
}
export type AnnotationWorkspaceState = ReturnType<typeof useAnnotationWorkspace>;
export function useAnnotationSummary(workspace: AnnotationWorkspaceState) {
  const [open, onOpenChange] = useState(false);
  const onFinish = () => {
    if (!workspace.target.correctionId || workspace.command.validReason()) onOpenChange(true);
  };
  const onSubmit = (confirmed: boolean) => {
    const photo = workspace.editor.upload.photo;
    if (photo)
      void workspace.command.submit(
        {
          storageKey: workspace.storageKey,
          revision: workspace.target.revision,
          context: workspace.context,
          uploadId: photo.uploadId,
          marks: workspace.editor.state.marks,
          elapsedSeconds: workspace.editor.activeTime.read(),
        },
        confirmed,
      );
  };
  return { open, onOpenChange, onFinish, onSubmit };
}
