import { CardSkeleton } from "../ui/CardSkeleton";
import { AnnotationSummaryDialog } from "./AnnotationSummaryDialog";
import { AnnotationCorrectionContext } from "./AnnotationCorrectionContext";
import { AnnotationWorkspaceHeader } from "./AnnotationWorkspaceHeader";
import { AnnotationDraftNotices } from "./AnnotationDraftNotices";
import { AnnotationWorkspacePhoto } from "./AnnotationWorkspacePhoto";
import { useAnnotationSummary, useAnnotationWorkspace } from "./use-annotation-workspace";
import type { AnnotationWorkspaceProps } from "./use-annotation-workspace";
import styles from "./annotation.module.css";
export function AnnotationWorkspace(props: AnnotationWorkspaceProps) {
  const workspace = useAnnotationWorkspace(props);
  const summary = useAnnotationSummary(workspace);
  if (!workspace.editor.draft.isReady) return <CardSkeleton />;
  return (
    <div className={styles.workspace}>
      <AnnotationWorkspaceHeader code={workspace.target.code} />
      <AnnotationCorrectionContext workspace={workspace} />
      <AnnotationDraftNotices workspace={workspace} />
      <AnnotationWorkspacePhoto workspace={workspace} onFinish={summary.onFinish} />
      <AnnotationSummaryDialog
        {...summary}
        marks={workspace.editor.state.marks}
        code={workspace.target.code}
        scope={props.scope}
        write={workspace.command.write}
      />
    </div>
  );
}
