import { AnnotationCanvasSurface } from "./AnnotationCanvasSurface";
import { AnnotationSettings } from "./AnnotationSettings";
import type { AnnotationWorkspaceState } from "./use-annotation-workspace";
import type { AnnotationWorkspaceView } from "./use-annotation-workspace-view";
import type { AnnotationPhoto } from "./annotation-upload";
import styles from "./annotation.module.css";
interface Props {
  workspace: AnnotationWorkspaceState;
  view: AnnotationWorkspaceView;
  photo: AnnotationPhoto;
  url: string;
}
export function AnnotationLoadedBody({ workspace, view, photo, url }: Props) {
  return (
    <div className={styles.body}>
      <AnnotationCanvasSurface workspace={workspace} view={view} photo={photo} url={url} />
      {view.showSettings && (
        <AnnotationSettings
          {...view}
          marks={workspace.editor.state.marks}
          width={photo.width}
          height={photo.height}
        />
      )}
    </div>
  );
}
