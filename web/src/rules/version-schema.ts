import type { MessageKey } from "@wolbachia/i18n";
import { z } from "zod";
import type { RuleParameter } from "./rules-query";

/** Longest reason the API takes (`REASON_MAX_LENGTH` of the serializer). */
export const REASON_MAX_LENGTH = 1000;
/** The API reads a decimal with up to 9 digits and 3 decimals (`VALUE_MAX_DIGITS`, `VALUE_DECIMAL_PLACES`). */
const DECIMAL = /^-?\d{1,9}(\.\d{1,3})?$/;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** What bounds a new value: the parameter's own limits and whether it takes decimals. */
export interface ValueBounds {
  min: number | null;
  max: number | null;
  isInteger: boolean;
}

export function boundsOf(parameter: RuleParameter): ValueBounds {
  return {
    min: parameter.min_value,
    max: parameter.max_value,
    isInteger: parameter.value_type === "integer",
  };
}

type RangeKey = Extract<
  MessageKey,
  "rules.error.range" | "rules.error.atLeast" | "rules.error.atMost"
>;

/** The sentence for a value outside the limits: it names the limit that exists. */
export function rangeKeyOf(min: number | null, max: number | null): RangeKey {
  if (min !== null && max !== null) return "rules.error.range";
  return min === null ? "rules.error.atMost" : "rules.error.atLeast";
}

function rangeIssue(value: number, { min, max }: ValueBounds): MessageKey | undefined {
  const isOutside = (min !== null && value < min) || (max !== null && value > max);
  return isOutside ? rangeKeyOf(min, max) : undefined;
}

/**
 * Why a typed value cannot be a new version, as a catalog key; `undefined` when it can. The same
 * checks as the server's (`validate_value`), which stays the authority: this only saves a trip.
 */
export function valueIssueOf(raw: string, bounds: ValueBounds): MessageKey | undefined {
  const text = raw.trim();
  if (text === "") return "rules.error.valueRequired";
  if (!DECIMAL.test(text)) return "rules.error.valueInvalid";
  const value = Number(text);
  if (bounds.isInteger && !Number.isInteger(value)) return "rules.error.notInteger";
  return rangeIssue(value, bounds);
}

/** The value the form holds as a number, or `null` while it is empty or not a valid value. */
export function validValueOf(raw: string, bounds: ValueBounds): number | null {
  return valueIssueOf(raw, bounds) === undefined ? Number(raw.trim()) : null;
}

/**
 * Schema of the "new version" form for one parameter. Messages are catalog keys; the form shows
 * them with the parameter's limits. The date has no past check here: "today" is the server's
 * clock in the organization's time zone, so `effective_from_in_past` comes from the API.
 */
export function createVersionSchema(bounds: ValueBounds) {
  return z.object({
    value: z.string().superRefine((raw, context) => {
      const message = valueIssueOf(raw, bounds);
      if (message !== undefined) context.addIssue({ code: "custom", message });
    }),
    effectiveFrom: z.string().regex(CALENDAR_DATE, { error: "rules.error.dateRequired" }),
    reason: z
      .string()
      .trim()
      .min(1, { error: "rules.error.reasonRequired" })
      .max(REASON_MAX_LENGTH, { error: "rules.error.reasonTooLong" }),
  });
}

export type VersionValues = z.infer<ReturnType<typeof createVersionSchema>>;
