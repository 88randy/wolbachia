import type { MessageKey } from "@wolbachia/i18n";
import { useT, useLocale } from "../../i18n/I18nProvider.tsx";
import { certificationState } from "./domain.ts";
import { StatusCard } from "../../ui/StatusCard.tsx";
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
const TONES = {
  unavailable: "warning",
  valid: "success",
  future: "info",
  expired: "danger",
  revoked: "danger",
} as const;
interface Props {
  readonly row: Certification;
  readonly now: Date;
  readonly timeZone: string;
}
export function CertificationCard({ row, now, timeZone }: Props) {
  const t = useT();
  const locale = useLocale();
  const state = certificationState(row, now);
  return (
    <StatusCard
      title={t("courier.flow.training.certificate")}
      statusLabel={t(STATE_KEYS[state])}
      tone={TONES[state]}
    >
      <TrainingFact
        label="trainings.mobile.validFrom"
        value={trainingDate(row.valid_from, locale, timeZone)}
      />
      <TrainingFact
        label="trainings.mobile.validUntil"
        value={trainingDate(row.valid_to, locale, timeZone)}
      />
    </StatusCard>
  );
}
