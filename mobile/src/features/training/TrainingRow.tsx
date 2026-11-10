import { AppText } from "../../ui/AppText.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import type { TrainingRow as Row } from "./presentation.ts";
import { QualificationCard } from "./QualificationCard.tsx";
import { CertificationCard } from "./CertificationCard.tsx";
import { EvaluationCard } from "./EvaluationCard.tsx";

export function TrainingRow({
  item,
  now,
  timeZone,
}: {
  readonly item: Row;
  readonly now: Date;
  readonly timeZone: string;
}) {
  const t = useT();
  if (item.kind === "heading")
    return (
      <AppText variant="overline" accessibilityRole="header">
        {t(item.label)}
      </AppText>
    );
  if (item.kind === "qualification")
    return <QualificationCard row={item.row} now={now} timeZone={timeZone} />;
  if (item.kind === "certificate")
    return <CertificationCard row={item.row} now={now} timeZone={timeZone} />;
  return <EvaluationCard row={item.row} timeZone={timeZone} />;
}
