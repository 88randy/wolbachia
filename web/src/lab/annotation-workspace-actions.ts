import { downloadAnnotationFile } from "./annotation-download";
import type { AnnotationWorkspaceState } from "./use-annotation-workspace";
export function annotationWorkspaceActions(workspace: AnnotationWorkspaceState) {
  const state = workspace.editor.state;
  const isLocked =
    workspace.command.write.isBusy ||
    ["uncertain", "conflict"].includes(workspace.command.write.failure?.kind ?? "");
  const onUndo = () => {
    if (!isLocked) workspace.editor.dispatch({ type: "undo" });
  };
  const onRedo = () => {
    if (!isLocked) workspace.editor.dispatch({ type: "redo" });
  };
  return {
    isLocked,
    onUndo,
    onRedo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    ...annotationDownloads(workspace),
  };
}

function annotationDownloads(workspace: AnnotationWorkspaceState) {
  const state = workspace.editor.state;
  const onDownloadImage = () => {
    const photo = workspace.editor.upload.photo;
    if (photo) downloadAnnotationFile(photo.file, photo.file.name);
  };
  const onDownloadMarks = () => {
    const photo = workspace.editor.upload.photo;
    if (!photo) return;
    const content = { image_width: photo.width, image_height: photo.height, marks: state.marks };
    downloadAnnotationFile(
      new Blob([JSON.stringify(content, null, 2)], { type: "application/json" }),
      workspace.target.code + "-marks.json",
    );
  };
  return { onDownloadImage, onDownloadMarks };
}
