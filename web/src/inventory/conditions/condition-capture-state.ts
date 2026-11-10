import { ApiError } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { tableErrorKey } from "../../data-table/table-error";
export const EMPTY_CAPTURE = { device_time: "", temperature_c: "", humidity_pct: "" };
export type CaptureValues = typeof EMPTY_CAPTURE;
export type CaptureErrors = Partial<Record<keyof CaptureValues, MessageKey>>;
export interface CaptureState {
  busy: boolean;
  message: MessageKey | null;
  uncertain: boolean;
  errors: CaptureErrors;
}
export const INITIAL_CAPTURE: CaptureState = {
  busy: false,
  message: null,
  uncertain: false,
  errors: {},
};
function captureErrors(error: unknown): CaptureErrors {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(
    Object.keys(error.envelope?.fields ?? {})
      .filter((key) => key in EMPTY_CAPTURE)
      .map((key) => [key, "conditions.state.invalid"]),
  );
}
export function captureFailure(error: unknown): CaptureState {
  const uncertain = !(error instanceof ApiError) || error.status >= 500;
  return {
    busy: false,
    uncertain,
    message: uncertain ? "conditions.state.uncertain" : tableErrorKey(error),
    errors: captureErrors(error),
  };
}
export function interruptedCapture(previous: CaptureState): CaptureState {
  return previous.busy
    ? { ...INITIAL_CAPTURE, uncertain: true, message: "conditions.state.review" }
    : previous;
}
