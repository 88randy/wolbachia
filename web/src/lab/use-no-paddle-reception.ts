import { useState } from "react";
import type { SyntheticEvent } from "react";
import type { ReceptionActions } from "./use-reception-command";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** No-paddle reception names one real reading and never manufactures a bag code. */
export function useNoPaddleReception(actions: ReceptionActions) {
  const [id, setId] = useState("");
  const isValid = UUID.test(id.trim());
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!isValid || actions.isBusy || actions.isReviewRequired) return;
    void actions.submit({ kind: "no_paddle", id: id.trim(), command_id: crypto.randomUUID() });
  };
  return { id, setId, isValid, submit };
}
