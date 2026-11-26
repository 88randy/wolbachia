import type { MessageKey } from "@wolbachia/i18n";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { RuleParameter } from "./rules-query";

/**
 * The API names a parameter by its `key` only (no label), so the web writes the name. The keys of
 * the parameters the seed creates are listed here; a key that is not (an organization may get
 * more) shows its own code, which is data, instead of failing.
 */
const NAME_KEYS: Readonly<Record<string, MessageKey>> = {
  lab_count_plausibility_limit: "rules.param.labCountPlausibilityLimit",
  lab_recount_sample_per_100: "rules.param.labRecountSamplePer100",
  max_distance_to_point_m: "rules.param.maxDistanceToPoint",
  min_distance_same_block_m: "rules.param.minDistanceSameBlock",
  speed_lock_kmh: "rules.param.speedLock",
  speed_unlock_seconds: "rules.param.speedUnlock",
  clock_skew_review_seconds: "rules.param.clockSkewReview",
  closed_house_weeks_to_relocate: "rules.param.closedHouseWeeks",
  incidents_to_relocate: "rules.param.incidentsToRelocate",
  fuel_efficiency_min_km_l: "rules.param.fuelEfficiencyMin",
  fuel_efficiency_max_km_l: "rules.param.fuelEfficiencyMax",
  session_idle_minutes: "rules.param.sessionIdle",
  reminder_minutes_before_end: "rules.param.reminderBeforeEnd",
  max_paddle_reuses: "rules.param.maxPaddleReuses",
  revisit_interval_days: "rules.param.revisitInterval",
  departure_requires_offline_map: "rules.param.departureRequiresOfflineMap",
  delivery_signature_mode: "rules.param.deliverySignatureMode",
  daily_task_target: "rules.param.dailyTaskTarget",
  max_gps_accuracy_m: "rules.param.maxGpsAccuracyM",
  pin_max_attempts: "rules.param.pinMaxAttempts",
};

/**
 * The API has no boolean or enum type: these parameters are integers (unit `count`) whose numbers
 * stand for options. The web knows them: it shows the option, never the number or the unit, and
 * the form sends the number back.
 */
interface OptionParameter {
  kind: "boolean" | "enum";
  options: readonly { value: number; labelKey: MessageKey }[];
}

const OPTION_PARAMETERS: Readonly<Record<string, OptionParameter>> = {
  departure_requires_offline_map: {
    kind: "boolean",
    options: [
      { value: 0, labelKey: "rules.option.no" },
      { value: 1, labelKey: "rules.option.yes" },
    ],
  },
  delivery_signature_mode: {
    kind: "enum",
    options: [
      { value: 0, labelKey: "rules.option.signatureEither" },
      { value: 1, labelKey: "rules.option.signatureWarehouse" },
      { value: 2, labelKey: "rules.option.signaturePhone" },
    ],
  },
};

export function optionKindOf(key: string): OptionParameter["kind"] | undefined {
  return OPTION_PARAMETERS[key]?.kind;
}

/** Typed on the API's unit enum: a new unit in the schema fails the build until it is named here. */
const UNIT_KEYS = {
  m: "rules.unit.meters",
  km_h: "rules.unit.kmPerHour",
  s: "rules.unit.seconds",
  min: "rules.unit.minutes",
  day: "rules.unit.days",
  week: "rules.unit.weeks",
  count: "rules.unit.count",
  km_l: "rules.unit.kmPerLiter",
} as const satisfies Record<RuleParameter["unit"], MessageKey>;

function isKnownUnit(unit: string): unit is keyof typeof UNIT_KEYS {
  return unit in UNIT_KEYS;
}

type Translate = (key: MessageKey) => string;

function nameOf(t: Translate, key: string): string {
  const messageKey = NAME_KEYS[key];
  return messageKey === undefined ? key : t(messageKey);
}

function unitOf(t: Translate, unit: string): string {
  return isKnownUnit(unit) ? t(UNIT_KEYS[unit]) : unit;
}

function optionsOf(t: Translate, key: string) {
  return OPTION_PARAMETERS[key]?.options.map((option) => ({
    value: String(option.value),
    label: t(option.labelKey),
  }));
}

function optionLabelOf(t: Translate, key: string, value: number): string | undefined {
  const option = OPTION_PARAMETERS[key]?.options.find((o) => o.value === value);
  return option === undefined ? undefined : t(option.labelKey);
}

export interface ParameterLabels {
  name: (key: string) => string;
  /** The unit of a parameter; empty for an option parameter (`key` given), which has none. */
  unit: (unit: string, key?: string) => string;
  /** The options of an option parameter (`value` is what the API takes), else `undefined`. */
  options: (key: string) => readonly { value: string; label: string }[] | undefined;
  /** A value as text: the option's label, or the number with its unit. */
  valueText: (
    parameter: { key: string; unit: string },
    value: number,
    format: (n: number) => string,
  ) => string;
}

/** Names, units and option labels in the interface language; unknown values show as they came. */
export function useParameterLabels(): ParameterLabels {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      name: (key) => nameOf(t, key),
      unit: (unit, key) => (key !== undefined && key in OPTION_PARAMETERS ? "" : unitOf(t, unit)),
      options: (key) => optionsOf(t, key),
      valueText: (parameter, value, format) =>
        optionLabelOf(t, parameter.key, value) ?? `${format(value)} ${unitOf(t, parameter.unit)}`,
    }),
    [t],
  );
}
