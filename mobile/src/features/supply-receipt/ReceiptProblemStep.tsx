import { ArrowRight, CircleCheck, CircleX } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { ChoiceButton } from "../../ui/ChoiceButton.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { ChoiceRow } from "../field-ui/ChoiceRow.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { quantityValue } from "./domain.ts";
import { isReceiptReadOnly } from "./editing.ts";
import { ReceiptDamagePhoto } from "./ReceiptDamagePhoto.tsx";
import { ReceiptFrame } from "./ReceiptFrame.tsx";
import type { ReceiptDraft } from "./receipt-types.ts";
import type { M05Model } from "./use-m-05.ts";

type Kind = "missing" | "damaged" | "other";
const KINDS: readonly Kind[] = ["missing", "damaged", "other"];

function useDiscrepancyEdit(model: M05Model) {
  return (kind: Kind, text: string) => {
    model.edit(
      "discrepancy",
      (eventId) => model.service.discrepancy(kind, text, eventId),
      (draft) => ({ ...draft, signature: null, discrepancy: { kind, text } }),
    );
  };
}

interface Props {
  readonly model: M05Model;
  readonly draft: ReceiptDraft;
  readonly onNext: () => void;
  readonly onBack: () => void;
}

/** Step 2 of 3: did everything arrive fine? A count that differs forces the "No" answer. */
export function ReceiptProblemStep({ model, draft, onNext, onBack }: Props) {
  const t = useT();
  const edit = useDiscrepancyEdit(model);
  const hasMismatch = draft.lines.some(
    (line) => quantityValue(line.quantity) !== quantityValue(line.expected),
  );
  const [wantsProblem, setWantsProblem] = useState(false);
  const hasProblem = wantsProblem || hasMismatch || draft.discrepancy !== null;
  const discrepancy = draft.discrepancy;
  const isLocked = isReceiptReadOnly(model);
  const isComplete = !hasProblem || (discrepancy !== null && isDiscrepancyDone(discrepancy, draft));
  return (
    <ReceiptFrame
      model={model}
      step={2}
      onBack={onBack}
      footer={
        <PrimaryButton
          icon={ArrowRight}
          label={t("field.action.next")}
          disabled={!isComplete}
          onPress={onNext}
        />
      }
    >
      <StepQuestion title={t("field.receipt.okQuestion")} />
      <View className="flex-row gap-3">
        <ChoiceButton
          tone="yes"
          icon={CircleCheck}
          label={t("courier.choice.yes")}
          isSelected={!hasProblem}
          disabled={hasMismatch || discrepancy !== null || isLocked}
          onPress={() => {
            setWantsProblem(false);
          }}
        />
        <ChoiceButton
          tone="no"
          icon={CircleX}
          label={t("courier.choice.no")}
          isSelected={hasProblem}
          disabled={isLocked}
          onPress={() => {
            setWantsProblem(true);
          }}
        />
      </View>
      {hasMismatch ? <InfoNotice tone="info" message={t("field.receipt.mismatchHint")} /> : null}
      {hasProblem ? (
        <>
          <StepQuestion title={t("field.receipt.whatKind")} />
          <View className="gap-3">
            {KINDS.map((kind) => (
              <ChoiceRow
                key={kind}
                label={t(`field.receipt.kind.${kind}`)}
                isSelected={discrepancy?.kind === kind}
                disabled={isLocked}
                onPress={() => {
                  edit(kind, discrepancy?.text ?? "");
                }}
              />
            ))}
          </View>
          {discrepancy === null ? null : (
            <ShiftField
              label={t("field.receipt.whatHappened")}
              value={discrepancy.text}
              disabled={isLocked}
              onChange={(text) => {
                edit(discrepancy.kind, text);
              }}
            />
          )}
          {discrepancy?.kind === "damaged" ? (
            <ReceiptDamagePhoto model={model} draft={draft} />
          ) : null}
        </>
      ) : null}
    </ReceiptFrame>
  );
}

function isDiscrepancyDone(
  discrepancy: NonNullable<ReceiptDraft["discrepancy"]>,
  draft: ReceiptDraft,
): boolean {
  if (discrepancy.kind === "other") return discrepancy.text.trim().length > 0;
  return discrepancy.kind !== "damaged" || draft.evidence.length > 0;
}
