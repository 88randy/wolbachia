import { useTranslation } from "react-i18next";
import { ResolutionFields } from "./ResolutionFields";
import { RetirementPrompt } from "./RetirementPrompt";
import { useExcludedPoints } from "./use-excluded-points";
import type { QuadrantDraft } from "./use-quadrant-draft";
interface Props {
  draft: QuadrantDraft;
  canCreatePoint: boolean;
}
export function ExcludedPoints({ draft, canCreatePoint }: Props) {
  const { t } = useTranslation();
  const excluded = useExcludedPoints(draft, canCreatePoint);
  return (
    <>
      <p role="status">
        {t(draft.canSubmit ? "geography.editor.ready" : "geography.editor.blocked")}
      </p>
      {draft.excluded.map((point) => (
        <ResolutionFields key={point.id} {...excluded.card(point)} />
      ))}
      <RetirementPrompt draft={draft} point={excluded.retiring} onClose={excluded.close} />
    </>
  );
}
