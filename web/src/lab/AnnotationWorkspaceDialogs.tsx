import { AnnotationHelpDialog } from "./AnnotationHelpDialog";
import { AnnotationShortcutsDialog } from "./AnnotationShortcutsDialog";
import type { AnnotationWorkspaceView } from "./use-annotation-workspace-view";

export function AnnotationWorkspaceDialogs({
  view,
  userId,
}: {
  view: AnnotationWorkspaceView;
  userId: string;
}) {
  return (
    <>
      <AnnotationHelpDialog
        userId={userId}
        open={view.showHelp}
        onOpenChange={view.onHelpChange}
        onCloseAutoFocus={view.onCloseAutoFocus}
      />
      <AnnotationShortcutsDialog
        open={view.showShortcuts}
        onOpenChange={view.onShortcutsChange}
        onCloseAutoFocus={view.onCloseAutoFocus}
      />
    </>
  );
}
