import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import type { QuadrantDraft } from "./use-quadrant-draft";
export function PublishBlocker({ draft }: { draft: QuadrantDraft }) {
  const { t } = useTranslation();
  return (
    <>
      <p id="publish-blocker">{t(publicationReason(draft))}</p>
      {draft.isWaiting && <p role="status">{t("geography.error.wait")}</p>}
    </>
  );
}

function publicationReason(draft: QuadrantDraft): MessageKey {
  if (draft.write.isBusy) return "states.loading.label";
  if (!draft.geometry) return "geography.error.geometry";
  if (
    draft.points.isPending ||
    draft.points.isError ||
    draft.points.isFetching ||
    !draft.hasAllBlockers
  )
    return "geography.editor.pointsLoading";
  if (draft.isWaiting) return "geography.error.wait";
  return draft.canSubmit ? "geography.editor.ready" : "geography.editor.blocked";
}
