import { useT } from "../../i18n/I18nProvider.tsx";
import { SectionTitle } from "../../ui/SectionTitle.tsx";
import type { TrainingRow as Row } from "./presentation.ts";
import { CertificationCard } from "./CertificationCard.tsx";
import { EvaluationCard } from "./EvaluationCard.tsx";
import { QualificationCard } from "./QualificationCard.tsx";

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
  if (item.kind === "heading") return <SectionTitle title={t(item.label)} />;
  if (item.kind === "qualification")
    return <QualificationCard row={item.row} now={now} timeZone={timeZone} />;
  if (item.kind === "certificate")
    return <CertificationCard row={item.row} now={now} timeZone={timeZone} />;
  return <EvaluationCard row={item.row} timeZone={timeZone} />;
}
