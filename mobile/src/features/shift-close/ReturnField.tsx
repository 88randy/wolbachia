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
function updateReturn(props: Props, returned: string): void {
  const { supply, lineId, sourceId, onChange } = props;
  onChange({
    ...supply,
    returns: [
      ...supply.returns.filter((line) => line.receiptLineId !== lineId),
      { receiptLineId: lineId, receiptSourceEventId: sourceId, returned },
    ],
  });
}
export function ReturnField(props: Props) {
  const { supply, lineId, disabled } = props;
  const t = useT();
  const returned = supply.returns.find((line) => line.receiptLineId === lineId)?.returned ?? "";
  const onChange = (returned: string) => {
    updateReturn(props, returned);
  };
  return (
    <Card>
      <AppText variant="caption">{lineId}</AppText>
      <ShiftField
        label={t("mobile.shiftClose.returnQuantity")}
        value={returned}
        decimal
        disabled={disabled}
        onChange={onChange}
      />
      <AppText>{t("mobile.shiftClose.returnDestination")}</AppText>
      <AppText variant="caption">{supply.source.originId}</AppText>
    </Card>
  );
}
