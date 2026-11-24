import { CardSkeleton } from "../ui/CardSkeleton";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { AnnotationWorkspaceDialogs } from "./AnnotationWorkspaceDialogs";
import { AnnotationDraftStatus } from "./AnnotationDraftStatus";
import { useNavigate } from "@tanstack/react-router";
import { AnnotationLoadedBody } from "./AnnotationLoadedBody";
import { useAnnotationWorkspaceView } from "./use-annotation-workspace-view";
import { useBlobUrl } from "./use-blob-url";
import { annotationWorkspaceActions } from "./annotation-workspace-actions";
import type { AnnotationWorkspaceState } from "./use-annotation-workspace";
import styles from "./annotation.module.css";
export function AnnotationLoaded({
  workspace,
  onFinish,
}: {
  workspace: AnnotationWorkspaceState;
  onFinish: () => void;
}) {
  const view = useAnnotationWorkspaceView();
  const navigate = useNavigate();
  const photo = workspace.editor.upload.photo;
  const url = useBlobUrl(photo?.file);
  const actions = annotationWorkspaceActions(workspace);
  if (!photo || !url) return <CardSkeleton />;
  return (
    <div className={styles.loaded}>
      <AnnotationToolbar
        {...view}
        {...actions}
        count={workspace.editor.state.marks.length}
        onFinish={onFinish}
        onBack={() => {
          void navigate({ to: "/lab/egg-counts", search: {} });
        }}
      />
      <AnnotationLoadedBody workspace={workspace} view={view} photo={photo} url={url} />
      <AnnotationDraftStatus status={workspace.editor.draft.status} />
      <AnnotationWorkspaceDialogs userId={workspace.scope.identity.userId} view={view} />
    </div>
  );
}
