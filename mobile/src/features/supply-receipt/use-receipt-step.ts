import { useEffect, useState } from "react";

const LAST_STEP = 3;

/** Which of the 3 receipt steps is shown; it starts over for each new delivery. */
export function useReceiptStep(draftId: string | undefined) {
  const [step, setStep] = useState(1);
  useEffect(() => {
    setStep(1);
  }, [draftId]);
  return {
    step,
    next: () => {
      setStep((current) => Math.min(current + 1, LAST_STEP));
    },
    back: () => {
      setStep((current) => Math.max(current - 1, 1));
    },
  };
}
