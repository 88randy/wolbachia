import { useT, useLocale } from "../../i18n/I18nProvider.tsx";
import { StatusCard } from "../../ui/StatusCard.tsx";
import { trainingDate } from "./presentation.ts";
import type { EvaluationFeedback } from "./types.ts";
import { EvaluationProvenance } from "./EvaluationProvenance.tsx";

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
  const t = useT();
  const locale = useLocale();
  const current = row.current;
  const outcome = current?.outcome ?? "incomplete";
  const date = current ? trainingDate(current.observed_at, locale, timeZone) : "";
  return (
    <StatusCard
      title={date || t("courier.flow.training.evaluation")}
      statusLabel={t(row.is_voided ? "trainings.mobile.voided" : OUTCOME_KEYS[outcome])}
      tone={row.is_voided ? "info" : outcome === "pass" ? "success" : "warning"}
    >
      <EvaluationProvenance row={row} />
    </StatusCard>
  );
}
