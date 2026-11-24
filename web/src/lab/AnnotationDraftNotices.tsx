import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import type { AnnotationWorkspaceState } from "./use-annotation-workspace";
import { AnnotationRecoverDialog } from "./AnnotationRecoverDialog";
export function AnnotationDraftNotices({ workspace }: { workspace: AnnotationWorkspaceState }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const draft = workspace.editor.draft;
  return (
    <>
      {draft.recoverable && (
        <AnnotationRecoverDialog
          onRecover={workspace.editor.recover}
          onDismiss={() => {
            void navigate({ to: "/lab/egg-counts", search: {} });
          }}
          onDiscard={() => {
            draft.closeRecovery();
            void draft.save(null);
          }}
        />
      )}
      <p role="status">
        {draft.status &&
          t(draft.status === "saved" ? "labAnnotation.draft.saved" : "labAnnotation.draft.failed")}
      </p>
    </>
  );
}
