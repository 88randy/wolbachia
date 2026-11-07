import type { LifecycleDraft } from "./types.ts";
import type { M09Model } from "./use-m-09.ts";
export interface LifecycleProps {
  readonly model: M09Model;
  readonly draft: LifecycleDraft;
}
