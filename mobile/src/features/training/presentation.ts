import type { MessageKey, Locale } from "@wolbachia/i18n";
import type { BadgeTone } from "../../ui/Badge.tsx";
import type { IconName } from "../../ui/icon-paths.ts";
import type { QualificationState } from "./domain.ts";
import type { Certification, EvaluationFeedback, Eligibility, TrainingSource } from "./types.ts";

export type TrainingRow =
  | { readonly kind: "heading"; readonly id: string; readonly label: MessageKey }
  | { readonly kind: "qualification"; readonly id: string; readonly row: Eligibility }
  | { readonly kind: "certificate"; readonly id: string; readonly row: Certification }
  | { readonly kind: "evaluation"; readonly id: string; readonly row: EvaluationFeedback };
export function trainingRows(source: TrainingSource | null): TrainingRow[] {
  if (source === null) return [];
  return [
    { kind: "heading", id: "qualification", label: "trainings.mobile.qualification" },
    ...source.eligibility.map((row): TrainingRow => ({
      kind: "qualification",
      id: `qualification:${row.id}`,
      row,
    })),
    { kind: "heading", id: "certificates", label: "trainings.mobile.certificates" },
    ...(source.records?.certificates ?? []).map((row): TrainingRow => ({
      kind: "certificate",
      id: `certificate:${row.id}`,
      row,
    })),
    { kind: "heading", id: "evaluations", label: "trainings.mobile.evaluations" },
    ...(source.records?.evaluations ?? []).map((row): TrainingRow => ({
      kind: "evaluation",
      id: `evaluation:${row.id}`,
      row,
    })),
  ];
}
export const QUALIFICATION_BADGE: Readonly<
  Record<QualificationState, { key: MessageKey; tone: BadgeTone; icon: IconName }>
> = {
  eligible: { key: "trainings.mobile.eligible", tone: "success", icon: "check" },
  blocked: { key: "trainings.mobile.blocked", tone: "critical", icon: "ban" },
  expired: { key: "trainings.mobile.expired", tone: "critical", icon: "clock" },
  unavailable: { key: "trainings.state.unavailable", tone: "warning", icon: "alert" },
};
export function trainingDate(value: string | null, locale: Locale, timeZone: string): string {
  return value === null
    ? ""
    : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(
        new Date(value),
      );
}
/** Nearest backend-supplied boundary; the clock narrows display but cannot create new qualification. */
export function nextTrainingBoundary(source: TrainingSource | null, now: number): number | null {
  const values = [
    ...(source?.eligibility ?? []).flatMap((row) => [
      row.valid_from,
      row.valid_until,
      row.next_change_at,
    ]),
    ...(source?.records?.certificates ?? []).flatMap((row) => [
      row.valid_from,
      row.valid_to,
      row.revoked_from,
    ]),
  ]
    .filter((value): value is string => value !== null)
    .map(Date.parse)
    .filter((value) => value > now);
  return values.length ? Math.min(...values) : null;
}
