import { AnnotationLoaded } from "./AnnotationLoaded";
import { AnnotationUpload } from "./AnnotationUpload";
import type { AnnotationWorkspaceState } from "./use-annotation-workspace";
export function AnnotationWorkspacePhoto({
  workspace,
  onFinish,
}: {
  workspace: AnnotationWorkspaceState;
  onFinish: () => void;
}) {
  return workspace.editor.upload.photo ? (
    <AnnotationLoaded workspace={workspace} onFinish={onFinish} />
  ) : (
    <AnnotationUpload
      upload={workspace.editor.upload}
      original={workspace.editor.original}
      canUpload={workspace.scope.identity.permissions?.includes("field.upload") === true}
      onChoose={workspace.editor.choose}
    />
  );
}
