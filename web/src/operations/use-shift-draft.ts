import { useState } from "react";
import type { MessageKey } from "@wolbachia/i18n";
import { useVoidLimits } from "../void/use-void-limits";
import { canDecide, reasonError } from "./shift-validation";
import type { DecisionKind, ShiftDetail } from "./shift-validation";
import { currentShiftReadSequence } from "./shifts-query";

export interface ShiftDecisionOptions {
  shift: ShiftDetail;
  kind: DecisionKind;
  isReady: boolean;
  readSequence: number;
}

function useReasonDraft() {
  const limits = useVoidLimits();
  const [reason, setReason] = useState("");
  const [isTouched, setTouched] = useState(false);
  const error = reasonError(reason, limits);
  return {
    reason,
    setReason,
    setTouched,
    limits,
    error: isTouched ? error : undefined,
    isInvalid: error !== undefined,
    onBlur: () => {
      setTouched(true);
    },
  };
}

function useReviewedFrame(options: ShiftDecisionOptions) {
  const [blockedRead, setBlockedRead] = useState(-1);
  const [failure, setFailure] = useState<MessageKey>();
  const [reviewedRevision, setRevision] = useState(options.shift.validation.revision);
  const isBlocked =
    options.readSequence <= blockedRead ||
    !options.isReady ||
    !canDecide(options.shift, options.kind) ||
    reviewedRevision !== options.shift.validation.revision ||
    (failure !== undefined && failure !== "shift.error.invalid");
  const startReview = () => {
    if (!options.isReady || options.readSequence <= blockedRead) return;
    setRevision(options.shift.validation.revision);
    setFailure(undefined);
  };
  const fail = (key: MessageKey) => {
    setFailure(key);
    if (key !== "shift.error.invalid") setBlockedRead(currentShiftReadSequence());
  };
  return { failure, fail, isBlocked, reviewedRevision, startReview };
}

/** Preserve the reason independently of the currently reviewed server revision. */
export function useShiftDraft(options: ShiftDecisionOptions) {
  const reason = useReasonDraft();
  const frame = useReviewedFrame(options);
  return { ...reason, ...frame };
}
