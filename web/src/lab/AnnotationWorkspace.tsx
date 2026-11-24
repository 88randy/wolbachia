import { CardSkeleton } from "../ui/CardSkeleton";
import { useRef } from "react";
import { AnnotationSummaryDialog } from "./AnnotationSummaryDialog";
import { AnnotationLeaveDialog } from "./AnnotationLeaveDialog";
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
  const element = useRef<HTMLDivElement>(null);
  if (!workspace.editor.draft.isReady) return <CardSkeleton />;
  return (
    <div className={styles.workspace} ref={element}>
      <AnnotationWorkspaceHeader code={workspace.target.code} />
      <AnnotationCorrectionContext workspace={workspace} />
      <AnnotationDraftNotices workspace={workspace} />
      <AnnotationWorkspacePhoto workspace={workspace} onFinish={summary.onFinish} />
      <AnnotationLeaveDialog
        blocker={workspace.navigation.blocker}
        hasDraftFailure={workspace.editor.draft.status === "failed"}
      />
      <AnnotationSummaryDialog
        {...summary}
        marks={workspace.editor.state.marks}
        code={workspace.target.code}
        scope={props.scope}
        write={workspace.command.write}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          element.current?.querySelector<HTMLCanvasElement>("canvas[tabindex='0']")?.focus();
        }}
      />
    </div>
  );
}
