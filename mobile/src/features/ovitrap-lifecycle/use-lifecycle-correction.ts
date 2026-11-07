import { useState } from "react";
import { validCorrectionReason, correctionPolicy } from "./domain.ts";
import type { LifecycleProps } from "./model.ts";
export function useLifecycleCorrection({ draft, model }: LifecycleProps) {
  const [reasonCode, setCode] = useState("");
  const [reason, setReason] = useState("");
  const { isBlocked, disabled, policy } = correctionGate({ draft, model }, reasonCode, reason);
  const correct = () => {
    void model.run(
      () => model.service.correct({ reasonCode, reason }, draft.eventId),
      draft.eventId,
    );
  };
  return { reasonCode, setCode, reason, setReason, isBlocked, disabled, policy, correct };
}

function correctionGate({ draft, model }: LifecycleProps, reasonCode: string, reason: string) {
  const isBlocked = correctionBlocked({ draft, model });
  const state = model.state;
  const selected = state?.correctionReasons?.find((item) => item.code === reasonCode);
  const policy = correctionPolicy(selected, state?.limits);
  const disabled = model.isBusy || !validCorrectionReason(reason, selected, state?.limits);
  return { isBlocked, disabled, policy };
}

function correctionBlocked({ draft, model }: LifecycleProps): boolean {
  const original = model.state?.history.find((item) => item.draft.eventId === draft.eventId);
  const hasAttempt = original?.corrections.some((item) => item.event.status !== "rejected");
  return Boolean(
    hasAttempt || model.state?.proposal?.decision || model.state?.proposal?.legacyDecision,
  );
}
