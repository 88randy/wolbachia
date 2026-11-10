import { TrainingFact } from "./TrainingFact.tsx";
import type { EvaluationFeedback } from "./types.ts";

export function EvaluationProvenance({ row }: { readonly row: EvaluationFeedback }) {
  return (
    <>
      <TrainingFact label="trainings.mobile.author" value={row.current?.created_by} />
      <TrainingFact label="trainings.mobile.source" value={row.current?.predecessor_id} />
      <TrainingFact label="trainings.mobile.reason" value={row.current?.reason} />
      <TrainingFact label="trainings.mobile.reason" value={row.void?.reason} />
      <TrainingFact label="trainings.mobile.author" value={row.void?.created_by} />
    </>
  );
}
