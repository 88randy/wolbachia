import { useState } from "react";
import type { M12Model } from "./use-m-12.ts";
export function useTypePicker(model: M12Model) {
  const [isOpen, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const state = model.state,
    draft = state?.draft;
  const close = () => {
    setOpen(false);
  };
  const open = () => {
    setOpen(true);
  };
  const choose = (id: string) => {
    if (!draft) return;
    close();
    void model.run(() => model.service.edit("type", id, draft.eventId));
  };
  return {
    isOpen,
    query,
    close,
    open,
    choose,
    setQuery,
    types: state?.types ?? [],
    selected: draft?.type?.current_version_id ?? null,
    disabled: model.isBusy || !state?.ready || state.event !== null,
  };
}
