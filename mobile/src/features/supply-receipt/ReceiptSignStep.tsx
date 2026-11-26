import { Save } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { isReceiptReadOnly } from "./editing.ts";
import { ReceiptFrame } from "./ReceiptFrame.tsx";
import { SignaturePad } from "./SignaturePad.tsx";
import type { ReceiptDraft } from "./receipt-types.ts";
import type { M05Model } from "./use-m-05.ts";

interface Props {
  readonly model: M05Model;
  readonly draft: ReceiptDraft;
  readonly onBack: () => void;
}

/** Step 3 of 3: sign with the finger and save the receipt on the phone. */
export function ReceiptSignStep({ model, draft, onBack }: Props) {
  const t = useT();
  const isSigned = draft.needsSignature === false;
  const hasSignature = draft.signature !== null;
  return (
    <ReceiptFrame
      model={model}
      step={3}
      onBack={onBack}
      footer={
        <PrimaryButton
          icon={Save}
          label={t("field.receipt.save")}
          isLoading={model.isBusy}
          disabled={(!hasSignature && !isSigned) || isReceiptReadOnly(model)}
          onPress={() => {
            void model.run(() => model.service.save(draft.eventId));
          }}
        />
      }
    >
      {isSigned ? <SignedAtWarehouse /> : <SignPad {...{ model, draft }} />}
    </ReceiptFrame>
  );
}

function SignPad({ model, draft }: Pick<Props, "model" | "draft">) {
  const t = useT();
  const hasSignature = draft.signature !== null;
  return (
    <>
      <StepQuestion title={t("field.receipt.signQuestion")} />
      <SignaturePad
        key={draft.eventId}
        strokes={draft.strokes}
        disabled={isReceiptReadOnly(model)}
        onChange={(strokes) => {
          model.edit(
            "strokes",
            (eventId) => model.service.strokes(strokes, eventId),
            (current) => ({ ...current, strokes, signature: null }),
          );
        }}
        onSign={(port) => {
          void model.run(() => model.service.signature(port, draft.eventId));
        }}
      />
      {hasSignature ? <InfoNotice tone="success" message={t("field.receipt.signSaved")} /> : null}
    </>
  );
}

function SignedAtWarehouse() {
  const t = useT();
  return <InfoNotice tone="success" message={t("field.receipt.signedAtWarehouse")} />;
}
