import type { FieldError } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { isMessageKey } from "../forms/message-key";
import { useFormatNumber } from "../format/use-formatters";
import type { ServerBounds } from "./create-version";
import type { RuleParameter } from "./rules-query";

/**
 * Translates the error of a form field. The message is a catalog key (written by the schema or by
 * the server's code); the range sentences take the limits, from the server's `out_of_range`
 * answer when there is one, else from the parameter the page loaded.
 */
export function useIssueText(
  parameter: RuleParameter,
  serverBounds: ServerBounds | undefined,
): (error: FieldError | undefined) => string | undefined {
  const { t } = useTranslation();
  const formatNumber = useFormatNumber();
  const { min, max } = serverBounds ?? { min: parameter.min_value, max: parameter.max_value };
  const bound = (value: number | null) => (value === null ? "" : formatNumber(value));
  return (error) => {
    if (error === undefined) return undefined;
    const key = isMessageKey(error.message) ? error.message : "errors.api.validation";
    return t(key, { min: bound(min), max: bound(max) });
  };
}
