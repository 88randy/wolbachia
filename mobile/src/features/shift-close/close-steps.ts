import type { CloseDraft } from "./domain.ts";
import type { M14Model } from "./use-m-14.ts";

/** Props every closing step receives. */
export interface StepProps {
  readonly model: M14Model;
  readonly draft: CloseDraft;
  readonly step: { readonly current: number; readonly total: number };
  readonly onNext: () => void;
  readonly onBack: () => void;
}
