import type { M05Model } from "./use-m-05.ts";
/** A retained receipt remains readable when its downloaded capture authority is unavailable. */
export function isReceiptReadOnly(model: Pick<M05Model, "state" | "isBusy">): boolean {
  return model.isBusy || !model.state?.ready || model.state.event !== null;
}
