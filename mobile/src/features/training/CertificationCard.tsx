import type { MessageKey } from "@wolbachia/i18n";
import { useT, useLocale } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Badge } from "../../ui/Badge.tsx";
import { Card } from "../../ui/Card.tsx";
import { certificationState } from "./domain.ts";
import { trainingDate } from "./presentation.ts";
import type { Certification } from "./types.ts";
import { TrainingFact } from "./TrainingFact.tsx";

const STATE_KEYS = {
  unavailable: "trainings.state.unavailable",
  valid: "trainings.mobile.valid",
  future: "trainings.mobile.future",
  expired: "trainings.mobile.expired",
  revoked: "trainings.mobile.revoked",
} as const satisfies Record<string, MessageKey>;
interface Props {
  readonly row: Certification;
  readonly now: Date;
  readonly timeZone: string;
}
export function CertificationCard({ row, now, timeZone }: Props) {
  const t = useT(),
    locale = useLocale();
  const state = certificationState(row, now);
  return (
    <Card isCritical={state === "expired" || state === "revoked"}>
      <AppText variant="caption">{t("trainings.field.trainingVersion")}</AppText>
      <AppText isMonospace>{row.training_version_id}</AppText>
      <Badge
        tone={state === "valid" ? "success" : "warning"}
        icon={state === "valid" ? "check" : "clock"}
        label={t(STATE_KEYS[state])}
      />
      <TrainingFact
        label="trainings.mobile.validFrom"
        value={trainingDate(row.valid_from, locale, timeZone)}
      />
      <TrainingFact
        label="trainings.mobile.validUntil"
        value={trainingDate(row.valid_to, locale, timeZone)}
      />
      <AppText variant="caption" isMonospace>
        {row.id}
      </AppText>
    </Card>
  );
}
