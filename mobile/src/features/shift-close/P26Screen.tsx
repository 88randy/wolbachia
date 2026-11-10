import { useState } from "react";
import { CloseOdometerStep } from "./CloseOdometerStep.tsx";
import { ClosePendingStep } from "./ClosePendingStep.tsx";
import { CloseSuppliesStep } from "./CloseSuppliesStep.tsx";
import type { CloseDraft } from "./domain.ts";
import type { M14Model } from "./use-m-14.ts";

/** Close the shift: what is missing, leftovers to return, final kilometers. */
export function P26Screen({
  model,
  draft,
}: {
  readonly model: M14Model;
  readonly draft: CloseDraft;
}) {
  const [index, setIndex] = useState(0);
  const hasSupplies = draft.supplies.length > 0 && model.state?.canReconcile === true;
  const kinds = hasSupplies
    ? (["pending", "supplies", "odometer"] as const)
    : (["pending", "odometer"] as const);
  const props = {
    model,
    draft,
    step: { current: index + 1, total: kinds.length },
    onNext: () => {
      setIndex(index + 1);
    },
    onBack: () => {
      setIndex(Math.max(index - 1, 0));
    },
  };
  const kind = kinds[index];
  if (kind === "pending") return <ClosePendingStep {...props} />;
  if (kind === "supplies") return <CloseSuppliesStep {...props} />;
  return <CloseOdometerStep {...props} />;
}
