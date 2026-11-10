import { useT, useLocale } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Badge } from "../../ui/Badge.tsx";
import { Card } from "../../ui/Card.tsx";
import { eventTypeKey } from "../../sync/inbox-model.ts";
import { qualificationState } from "./domain.ts";
import { QUALIFICATION_BADGE, trainingDate } from "./presentation.ts";
import type { Eligibility } from "./types.ts";
import { TrainingFact } from "./TrainingFact.tsx";

export function QualificationCard({
  row,
  now,
  timeZone,
}: {
  readonly row: Eligibility;
  readonly now: Date;
  readonly timeZone: string;
}) {
  const t = useT(),
    locale = useLocale();
  const state = qualificationState(row, now),
    badge = QUALIFICATION_BADGE[state];
  return (
    <Card isCritical={state === "expired" || state === "blocked"}>
      <AppText variant="button">{t(eventTypeKey(row.action))}</AppText>
      <Badge tone={badge.tone} icon={badge.icon} label={t(badge.key)} />
      <TrainingFact label="trainings.mobile.context" value={row.center_id} />
      <TrainingFact label="trainings.mobile.context" value={row.quadrant_id} />
      <TrainingFact
        label="trainings.mobile.validUntil"
        value={trainingDate(row.valid_until, locale, timeZone)}
      />
      {state !== "eligible" ? <AppText>{t("trainings.mobile.boundary")}</AppText> : null}
    </Card>
  );
}
