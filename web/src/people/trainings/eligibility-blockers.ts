import type { MessageKey } from "@wolbachia/i18n";
const BLOCKERS: Readonly<Record<string, MessageKey>> = {
  training_requirements_unavailable: "trainings.eligibility.requirementsMissing",
  training_configuration_unavailable: "trainings.eligibility.configurationMissing",
  certification_missing_or_expired: "trainings.eligibility.certificateExpired",
  subject_unavailable: "trainings.course.unavailable",
};
export function eligibilityBlockerKey(code: string): MessageKey {
  return BLOCKERS[code] ?? "trainings.eligibility.unavailable";
}
