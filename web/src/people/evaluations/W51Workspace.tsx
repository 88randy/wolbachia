import { useCan } from "../../session/use-can";
import { EvaluationCapture } from "./EvaluationCapture";
import { EvaluationReadWorkspace } from "./EvaluationReadWorkspace";
import { EvaluationCorrectionGap } from "./EvaluationCorrectionGap";
import { RubricLookup } from "./RubricLookup";
import type { EvaluationScope } from "./evaluation-query";
export function W51Workspace({ scope, item }: { scope: EvaluationScope; item: string }) {
  const can = useCan();
  return (
    <>
      {can("evaluation.create") ? (
        <EvaluationCapture scope={scope} />
      ) : (
        <RubricLookup scope={scope} />
      )}
      <EvaluationReadWorkspace scope={scope} item={item} />
      <EvaluationCorrectionGap />
    </>
  );
}
