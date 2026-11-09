import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Card } from "../../ui/Card.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import type { ReconcileDraft } from "./domain.ts";
interface Props {
  readonly supply: ReconcileDraft;
  readonly lineId: string;
  readonly sourceId: string;
  readonly disabled: boolean;
  readonly onChange: (supply: ReconcileDraft) => void;
}
export function ReturnField({ supply, lineId, sourceId, disabled, onChange }: Props) {
  const t = useT();
  const returned = supply.returns.find((line) => line.receiptLineId === lineId)?.returned ?? "";
  return <Card>
    <AppText variant="mono">{lineId}</AppText>
    <ShiftField label={t("mobile.shiftClose.returnQuantity")} value={returned} decimal disabled={disabled} onChange={(returned) => { onChange({ ...supply, returns: [...supply.returns.filter((line) => line.receiptLineId !== lineId), { receiptLineId: lineId, receiptSourceEventId: sourceId, returned }] }); }} />
    <AppText>{t("mobile.shiftClose.returnDestination")}</AppText><AppText variant="mono">{supply.source.originId}</AppText>
  </Card>;
}
