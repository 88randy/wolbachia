import { useT, useLocale } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Badge } from "../../ui/Badge.tsx";
import { Card } from "../../ui/Card.tsx";
import { trainingDate } from "./presentation.ts";
import type { EvaluationFeedback } from "./types.ts";
import { EvaluationProvenance } from "./EvaluationProvenance.tsx";
import { TrainingFact } from "./TrainingFact.tsx";

const OUTCOME_KEYS = {
  pass: "trainings.mobile.pass",
  low: "trainings.mobile.low",
  critical_failure: "trainings.mobile.critical",
  incomplete: "trainings.mobile.incomplete",
} as const;
interface Props {
  readonly row: EvaluationFeedback;
  readonly timeZone: string;
}
export function EvaluationCard({ row, timeZone }: Props) {
  const t = useT(),
    locale = useLocale();
  const current = row.current,
    outcome = current?.outcome ?? "incomplete";
  return (
    <Card>
      <Badge
        tone={row.is_voided ? "neutral" : outcome === "pass" ? "success" : "warning"}
        icon={row.is_voided ? "ban" : outcome === "pass" ? "check" : "alert"}
        label={t(row.is_voided ? "trainings.mobile.voided" : OUTCOME_KEYS[outcome])}
      />
      {current ? (
        <AppText isMonospace>{trainingDate(current.observed_at, locale, timeZone)}</AppText>
      ) : null}
      <TrainingFact label="trainings.mobile.revision" value={row.revision} />
      <AppText variant="caption" isMonospace>
        {row.id}
      </AppText>
      <EvaluationProvenance row={row} />
    </Card>
  );
}
