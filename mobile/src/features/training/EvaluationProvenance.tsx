import { TrainingFact } from "./TrainingFact.tsx";
import type { EvaluationFeedback } from "./types.ts";

export function EvaluationProvenance({ row }: { readonly row: EvaluationFeedback }) {
  return (
    <>
      <TrainingFact label="trainings.mobile.reason" value={row.current?.reason} />
      <TrainingFact label="trainings.mobile.reason" value={row.void?.reason} />
    </>
  );
}
