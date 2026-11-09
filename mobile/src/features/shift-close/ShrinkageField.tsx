import { useT } from "../../i18n/I18nProvider.tsx";
import { Card } from "../../ui/Card.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { ShrinkageEvidenceFields } from "./ShrinkageEvidenceFields.tsx";
import type { ReconcileDraft } from "./domain.ts";
import type { M14Model } from "./use-m-14.ts";

export type ShrinkageLine = NonNullable<ReconcileDraft["shrinkage"]>[number];
interface Props {
  readonly model: M14Model;
  readonly supply: ReconcileDraft;
  readonly lineId: string;
  readonly sourceId: string;
}
function shrinkageLine({ supply, lineId, sourceId }: Props): ShrinkageLine {
  return (
    supply.shrinkage?.find((line) => line.receiptLineId === lineId) ?? {
      receiptLineId: lineId,
      receiptSourceEventId: sourceId,
      quantity: "",
      reasonCode: "",
      reason: "",
    }
  );
}
function editShrinkage(props: Props, line: ShrinkageLine, patch: Partial<ShrinkageLine>): void {
  const { model, supply, lineId } = props;
  const next = {
    ...supply,
    shrinkage: [
      ...(supply.shrinkage ?? []).filter((item) => item.receiptLineId !== lineId),
      { ...line, ...patch },
    ],
  };
  model.edit({
    supplies:
      model.state?.draft?.supplies.map((item) => (item.eventId === supply.eventId ? next : item)) ??
      [],
  });
}
export function ShrinkageField(props: Props) {
  const { model, supply } = props;
  const t = useT();
  const line = shrinkageLine(props);
  const edit = (patch: Partial<ShrinkageLine>) => {
    editShrinkage(props, line, patch);
  };
  const changeQuantity = (quantity: string) => {
    edit({ quantity });
  };
  return (
    <Card>
      <ShiftField
        label={t("mobile.shiftClose.shrinkageQuantity")}
        value={line.quantity}
        decimal
        disabled={model.isBusy}
        onChange={changeQuantity}
      />
      {line.quantity && Number(line.quantity) !== 0 ? (
        <ShrinkageEvidenceFields model={model} supply={supply} line={line} edit={edit} />
      ) : null}
    </Card>
  );
}
