import { CardSkeleton } from "../ui/CardSkeleton";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { AnnotationHelpDialog } from "./AnnotationHelpDialog";
import { AnnotationLoadedBody } from "./AnnotationLoadedBody";
import { useAnnotationWorkspaceView } from "./use-annotation-workspace-view";
import { useBlobUrl } from "./use-blob-url";
import { annotationWorkspaceActions } from "./annotation-workspace-actions";
import type { AnnotationWorkspaceState } from "./use-annotation-workspace";
export function AnnotationLoaded({
  workspace,
  onFinish,
}: {
  workspace: AnnotationWorkspaceState;
  onFinish: () => void;
}) {
  const view = useAnnotationWorkspaceView();
  const photo = workspace.editor.upload.photo;
  const url = useBlobUrl(photo?.file);
  const actions = annotationWorkspaceActions(workspace);
  if (!photo || !url) return <CardSkeleton />;
  return (
    <>
      <AnnotationToolbar
        {...view}
        {...actions}
        count={workspace.editor.state.marks.length}
        onFinish={onFinish}
      />
      <AnnotationLoadedBody workspace={workspace} view={view} photo={photo} url={url} />
      <AnnotationHelpDialog
        userId={workspace.scope.identity.userId}
        open={view.showHelp}
        onOpenChange={view.onHelpChange}
      />
    </>
  );
}
