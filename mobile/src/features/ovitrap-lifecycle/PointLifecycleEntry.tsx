import { LifecycleEntry } from "./LifecycleEntry.tsx";
import type { M08Model } from "../ovitrap-check/use-m-08.ts";
export function PointLifecycleEntry({ model }: { readonly model: M08Model }) {
  const draft = model.state?.draft;
  if (
    !model.state?.lifecycleTargetId ||
    !draft?.point ||
    (draft.mode !== "check" && !model.state.event)
  )
    return null;
  return (
    <LifecycleEntry ovitrapId={model.state.lifecycleTargetId} manualCapture={draft.manualCapture} />
  );
}
