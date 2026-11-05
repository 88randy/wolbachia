import { createPortal } from "react-dom";
import { RetirementDialog } from "./RetirementDialog";
import type { QuadrantDraft } from "./use-quadrant-draft";
interface Props {
  draft: QuadrantDraft;
  point: string | null;
  onClose: () => void;
}
export function RetirementPrompt({ draft, point, onClose }: Props) {
  const record = draft.excluded.find((item) => item.id === point);
  if (!record) return null;
  const save = (evidence: string) => {
    draft.setResolutions((previous) => ({
      ...previous,
      [record.id]: { point: record.id, decision: "remove", evidence },
    }));
  };
  return createPortal(
    <div
      onSubmit={(event) => {
        event.stopPropagation();
      }}
    >
      <RetirementDialog code={record.code} onClose={onClose} onEvidence={save} />
    </div>,
    document.body,
  );
}
