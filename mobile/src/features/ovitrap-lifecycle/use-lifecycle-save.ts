import { useState } from "react";
import type { LifecycleProps } from "./model.ts";
export function useLifecycleSave({ model, draft }: LifecycleProps) {
  const [isOpen, setOpen] = useState(false);
  const isBlocked = Boolean(
    model.state?.gate || model.state?.isScopeBlocked || model.state?.isShiftBlocked,
  );
  const close = () => {
    setOpen(false);
  };
  const save = () => {
    void model
      .run(() => model.service.save(draft.eventId), draft.eventId)
      .then((isSaved) => {
        if (isSaved) close();
      });
  };
  const submit = () => {
    if (draft.kind === "remove") setOpen(true);
    else save();
  };
  return { isOpen, isBlocked, close, save, submit };
}
