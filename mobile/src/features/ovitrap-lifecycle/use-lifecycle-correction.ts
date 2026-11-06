import { useState } from "react";
import { validReason } from "../ovitrap-check/domain.ts";
import type { LifecycleProps } from "./model.ts";
export function useLifecycleCorrection({ draft, model }: LifecycleProps) {
  const [reasonCode, setCode] = useState("");
  const [reason, setReason] = useState("");
  const original = model.state?.history.find((item) => item.draft.eventId === draft.eventId);
  const hasAttempt = original?.corrections.some((item) => item.event.status !== "rejected");
  const isBlocked = Boolean(hasAttempt || model.state?.proposal?.decision);
  const disabled = model.isBusy || !reasonCode || !validReason(reason);
  const correct = () => {
    void model.run(
      () => model.service.correct({ reasonCode, reason }, draft.eventId),
      draft.eventId,
    );
  };
  return { reasonCode, setCode, reason, setReason, isBlocked, disabled, correct };
}
