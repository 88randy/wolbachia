import { useCallback, useId, useRef, useState } from "react";
import type { TrainingField } from "./training-fields";
import { isTrainingFieldValid } from "./training-fields";
import type { TrainingDraft } from "./training-input";

/** Private fields live only in their keyed record owner, and survive failed submissions. */
export function useTrainingDraft(initial: TrainingDraft = {}) {
  const [draft, setDraft] = useState<TrainingDraft>(initial);
  const [hasSubmitted, setSubmitted] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const fieldPrefix = useId();
  const retire = useCallback(() => {
    setDraft({});
    setSubmitted(false);
  }, []);
  const setField = (key: string, value: string) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };
  function validate(fields: readonly TrainingField[]) {
    setSubmitted(true);
    const isValid = fields.every((field) => isTrainingFieldValid(field, draft));
    if (!isValid) queueMicrotask(() => alertRef.current?.focus());
    return isValid;
  }
  return { draft, setField, hasSubmitted, validate, alertRef, fieldPrefix, retire };
}
