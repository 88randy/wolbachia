import { useCan } from "../session/use-can";
import { EggAnnotationViewer } from "./EggAnnotationViewer";
import { CorrectCountDialog } from "./CorrectCountDialog";
import type { Count, LabScope } from "./lab-query";
export function CountHistoryActions({
  count,
  scope,
  draftKey,
}: {
  count: Count;
  scope: LabScope;
  draftKey: string;
}) {
  const canCorrect = useCan()("egg_count.void");
  return (
    <div className="flex flex-wrap gap-2">
      {count.annotation_id && <EggAnnotationViewer scope={scope} countId={count.id} />}
      {canCorrect && count.is_current && !count.voided && (
        <CorrectCountDialog scope={scope} count={count} draftKey={draftKey} />
      )}
    </div>
  );
}
