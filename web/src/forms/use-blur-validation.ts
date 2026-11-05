import { useState } from "react";
/** Validate on blur, then on change only after a first failure; caller retains the draft. */
export function useBlurValidation(validate: (value: string) => string | undefined) {
  const [error, setError] = useState<string>();
  const [hasFailed, setHasFailed] = useState(false);
  function validateValue(value: string) {
    const next = validate(value);
    setError(next);
    if (next !== undefined) setHasFailed(true);
  }
  return {
    error,
    onBlur: (value: string) => {
      validateValue(value);
    },
    onChange: (value: string) => {
      if (hasFailed) validateValue(value);
    },
  };
}
