import { useState } from "react";
import type { SyntheticEvent } from "react";
import { countCharacters, hasForbiddenCharacters, normalizeReason } from "./count-characters";
import type { VoidResult } from "./submit-void";
import { useVoidRequest } from "./use-void-request";
import type { VoidFailure } from "./void-failure";
import type { VoidLimits } from "./void-limits";

interface VoidFormOptions {
  limits: VoidLimits;
  /** Sends the void; the screen owns the request (`submitVoid`). Receives the trimmed reason. */
  submit: (reason: string) => Promise<VoidResult>;
  onVoided: () => void;
}

export interface VoidForm {
  reason: string;
  setReason: (reason: string) => void;
  /** Visible characters of the normalized reason, counted as the API does. */
  count: number;
  /** The server's value when it refused the reason, else the one the form was given. */
  minLength: number;
  maxLength: number;
  isBusy: boolean;
  hasTooShortError: boolean;
  /** A failure that is not about the reason's length (shown in the form's alert). */
  failure: VoidFailure | undefined;
  handleSubmit: (event: SyntheticEvent) => void;
}

/**
 * State of the void dialog. The minimum is mirrored from the server (`limits`) and corrected by
 * its answer if they ever differ: the request is the authority, this only saves a round trip.
 */
export function useVoidForm({ limits, submit, onVoided }: VoidFormOptions): VoidForm {
  const [reason, setReason] = useState("");
  const request = useVoidRequest(submit, onVoided);
  const { status } = request;
  const minLength = request.serverMin ?? limits.minLength;
  const normalized = normalizeReason(reason);
  const count = countCharacters(normalized);

  function handleSubmit(event: SyntheticEvent) {
    event.preventDefault();
    if (status.kind === "busy") return;
    if (hasForbiddenCharacters(normalized)) request.markFailed({ kind: "invalidCharacters" });
    else if (count < minLength) request.markTooShort();
    else void request.send(normalized);
  }

  return {
    reason,
    setReason,
    count,
    minLength,
    maxLength: limits.maxLength,
    isBusy: status.kind === "busy",
    hasTooShortError: status.kind === "tooShort" && count < minLength,
    failure: status.kind === "failed" ? status.failure : undefined,
    handleSubmit,
  };
}
