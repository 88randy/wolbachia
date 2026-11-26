import { useMemo } from "react";
import { EggAnnotationCanvas } from "./EggAnnotationCanvas";
import { ANNOTATION_COLORS } from "./AnnotationSettings";
import { annotationWorkspaceActions } from "./annotation-workspace-actions";
import type { AnnotationWorkspaceState } from "./use-annotation-workspace";
import type { AnnotationWorkspaceView } from "./use-annotation-workspace-view";
import type { AnnotationPhoto } from "./annotation-upload";
import type { AnnotationMark } from "./annotation-state";
import styles from "./annotation.module.css";
interface Props {
  workspace: AnnotationWorkspaceState;
  view: AnnotationWorkspaceView;
  photo: AnnotationPhoto;
  url: string;
}
export function AnnotationCanvasSurface({ workspace, view, photo, url }: Props) {
  const image = useMemo(
    () => ({ src: url, width: photo.width, height: photo.height }),
    [url, photo.width, photo.height],
  );
  const actions = annotationWorkspaceActions(workspace);
  const onMarksChange = actions.isLocked
    ? undefined
    : (marks: AnnotationMark[]) => {
        workspace.command.write.clearFailure();
        workspace.editor.dispatch({ type: "replace", marks });
      };
  return (
    <div className={styles.canvas}>
      <EggAnnotationCanvas
        {...view}
        {...actions}
        ref={view.canvas}
        image={image}
        marks={workspace.editor.state.marks}
        onMarksChange={onMarksChange}
        markerColor={ANNOTATION_COLORS[view.color]}
        onToggleGrid={view.onGrid}
        onHelp={view.onHelp}
      />
    </div>
  );
}
