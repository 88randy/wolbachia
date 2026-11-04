import type { FieldError } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { isMessageKey } from "./message-key";

/**
 * Translates the error of a field. The message RHF carries is a catalog key (set by the Zod
 * schema or by `setError`); anything else falls back to the generic validation message.
 */
export function useFieldError(): (error: FieldError | undefined) => string | undefined {
  const { t } = useTranslation();
  return (error) => {
    if (error === undefined) return undefined;
    return t(isMessageKey(error.message) ? error.message : "errors.api.validation");
  };
}
