import { ArrowRight } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Counter } from "../../ui/Counter.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { isReceiptReadOnly } from "./editing.ts";
import { ReceiptFrame } from "./ReceiptFrame.tsx";
import { plainQuantity } from "./plain-quantity.ts";
import { ReceiptScanButton } from "./ReceiptScanButton.tsx";
import type { ReceiptDraft } from "./receipt-types.ts";
import type { M05Model } from "./use-m-05.ts";

type Line = ReceiptDraft["lines"][number];

function useLineEdit(model: M05Model) {
  return (line: Line, value: string) => {
    model.edit(
      `quantity.${line.id}`,
      (eventId) => model.service.quantity(line.id, value, eventId),
      (draft) => ({
        ...draft,
        signature: null,
        lines: draft.lines.map((current) =>
          current.id === line.id ? { ...current, quantity: value } : current,
        ),
      }),
    );
  };
}

interface Props {
  readonly model: M05Model;
  readonly draft: ReceiptDraft;
  readonly onNext: () => void;
}

/** Step 1 of 3: how many of each supply arrived. Whole numbers use big plus/minus buttons. */
export function ReceiptCountStep({ model, draft, onNext }: Props) {
  const t = useT();
  const edit = useLineEdit(model);
  const isLocked = isReceiptReadOnly(model);
  return (
    <ReceiptFrame
      model={model}
      step={1}
      footer={<PrimaryButton icon={ArrowRight} label={t("field.action.next")} onPress={onNext} />}
    >
      <StepQuestion title={t("field.receipt.countQuestion")} hint={t("field.receipt.countHint")} />
      <ReceiptScanButton model={model} />
      {draft.lines.map((line, index) => {
        const label = t("field.receipt.supply", {
          number: index + 1,
          expected: plainQuantity(line.expected),
        });
        const current = Number(line.quantity);
        return Number.isInteger(Number(line.expected)) && Number.isInteger(current) ? (
          <Counter
            key={line.id}
            label={label}
            value={current}
            max={line.pieceId === null ? Number(line.expected) : 1}
            onChange={(value) => {
              if (!isLocked) edit(line, String(value));
            }}
          />
        ) : (
          <ShiftField
            key={line.id}
            label={label}
            value={line.quantity}
            decimal
            disabled={isLocked}
            onChange={(value) => {
              edit(line, value);
            }}
          />
        );
      })}
    </ReceiptFrame>
  );
}
