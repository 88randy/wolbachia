import { useT, useLocale } from "../../i18n/I18nProvider.tsx";
import { eventTypeKey } from "../../sync/inbox-model.ts";
import { AppText } from "../../ui/AppText.tsx";
import { StatusCard } from "../../ui/StatusCard.tsx";
import type { StatusTone } from "../../ui/StatusCard.tsx";
import { qualificationState } from "./domain.ts";
import { QUALIFICATION_BADGE, trainingDate } from "./presentation.ts";
import type { Eligibility } from "./types.ts";
import { TrainingFact } from "./TrainingFact.tsx";

const TONES: Readonly<Record<string, StatusTone>> = {
  success: "success",
  critical: "danger",
  warning: "warning",
};

export function QualificationCard({
  row,
  now,
  timeZone,
}: {
  readonly row: Eligibility;
  readonly now: Date;
  readonly timeZone: string;
}) {
  const t = useT();
  const locale = useLocale();
  const state = qualificationState(row, now);
  const badge = QUALIFICATION_BADGE[state];
  return (
    <StatusCard
      title={t(eventTypeKey(row.action))}
      statusLabel={t(badge.key)}
      tone={TONES[badge.tone] ?? "info"}
    >
      <TrainingFact
        label="trainings.mobile.validUntil"
        value={trainingDate(row.valid_until, locale, timeZone)}
      />
      {state !== "eligible" ? (
        <AppText variant="body">{t("trainings.mobile.boundary")}</AppText>
      ) : null}
    </StatusCard>
  );
}
