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
};

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

/** `name(key)` and `unit(unit)` in the interface language; unknown values show as they came. */
export function useParameterLabels(): {
  name: (key: string) => string;
  unit: (unit: string) => string;
} {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      name: (key) => {
        const messageKey = NAME_KEYS[key];
        return messageKey === undefined ? key : t(messageKey);
      },
      unit: (unit) => (isKnownUnit(unit) ? t(UNIT_KEYS[unit]) : unit),
    }),
    [t],
  );
}
