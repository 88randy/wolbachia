import { useState } from "react";
import { countCharacters, hasForbiddenCharacters, normalizeReason } from "./count-characters";
import type { VoidLimits } from "./void-limits";
import type { VoidRequest } from "./use-void-request";
import type { VoidChoice } from "./use-void-form";

/** Other's text keeps the server's minimum and field errors next to the counter. */
export function useVoidText(limits: VoidLimits, request: VoidRequest) {
  const [reason, setReason] = useState("");
  const minLength = request.serverMin ?? limits.minLength;
  const normalized = normalizeReason(reason);
  const count = countCharacters(normalized);
  const failure = request.status.kind === "failed" ? request.status.failure : undefined;
  const reasonError =
    failure?.kind === "requiredForOther"
      ? "requiredForOther"
      : request.status.kind === "tooShort" && count < minLength
        ? "tooShort"
        : undefined;
  return {
    reason,
    normalized,
    count,
    minLength,
    maxLength: limits.maxLength,
    reasonError,
    failure: failure?.kind === "requiredForOther" ? undefined : failure,
    setReason: (text: string) => {
      setReason(text);
      if (failure?.kind === "requiredForOther") request.reset();
    },
  };
}

/** Only Other choices reach the free-text validation boundary. */
export function sendOtherChoice(request: VoidRequest, choice: VoidChoice, minLength: number) {
  if (hasForbiddenCharacters(choice.reason)) request.markFailed({ kind: "invalidCharacters" });
  else if (countCharacters(choice.reason) < minLength) request.markTooShort();
  else void request.send(choice);
}
