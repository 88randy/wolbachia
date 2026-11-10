import type { Schemas } from "@wolbachia/api-client";
import { INITIAL_CAPTURE } from "./condition-capture-state";
import { runConditionCapture } from "./run-condition-capture";
import { useConditionCaptureState } from "./use-condition-capture-state";
export { EMPTY_CAPTURE } from "./condition-capture-state";
export type { CaptureValues, CaptureErrors } from "./condition-capture-state";
/** A retired request never publishes or replays; explicit current-state review retains the draft. */
export function useConditionCapture(isDenied = false) {
  const model = useConditionCaptureState(isDenied);
  const { values, setValues, state, setState, scope, attempt } = model;
  async function submit(status: Schemas["ConditionStatus"]) {
    if (
      isDenied ||
      !status.can_create_condition ||
      attempt.current ||
      state.uncertain ||
      !scope.identity.isSettled ||
      !scope.isCurrentRead()
    )
      return;
    const token = Symbol();
    attempt.current = token;
    setState({ ...INITIAL_CAPTURE, busy: true });
    await runConditionCapture({ ...model, lot: status.lot_id, token });
  }
  function reviewed() {
    if (!attempt.current && scope.identity.isSettled && scope.isCurrentRead())
      setState(INITIAL_CAPTURE);
  }
  return { values, setValues, state, submit, reviewed };
}
