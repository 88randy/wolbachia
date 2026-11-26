import { ArrowRight } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { isReceiptReadOnly } from "./editing.ts";
import { ReceiptCountLine } from "./ReceiptCountLine.tsx";
import { ReceiptFrame } from "./ReceiptFrame.tsx";
import { ReceiptScanButton } from "./ReceiptScanButton.tsx";
import type { ReceiptDraft } from "./receipt-types.ts";
import { supplyName } from "./supply-name.ts";
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
  return (
    <ReceiptFrame
      model={model}
      step={1}
      footer={<PrimaryButton icon={ArrowRight} label={t("field.action.next")} onPress={onNext} />}
    >
      <StepQuestion title={t("field.receipt.countQuestion")} hint={t("field.receipt.countHint")} />
      <ReceiptScanButton model={model} />
      {draft.lines.map((line, index) => (
        <ReceiptCountLine
          key={line.id}
          line={line}
          name={supplyName(model.state?.assignments ?? [], draft.assignmentId, line)}
          number={index + 1}
          isLocked={isReceiptReadOnly(model)}
          onChange={(value) => {
            edit(line, value);
          }}
        />
      ))}
    </ReceiptFrame>
  );
}
