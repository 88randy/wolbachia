import { ArrowRight, Camera } from "lucide-react-native";
import { View } from "react-native";
import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Counter } from "../../ui/Counter.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { ChoiceRow } from "../field-ui/ChoiceRow.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { catalogLabel } from "../ovitrap-check/labels.ts";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { CloseFrame } from "./CloseFrame.tsx";
import type { ReconcileDraft } from "./domain.ts";
import type { StepProps } from "./close-steps.ts";

type Shrinkage = NonNullable<ReconcileDraft["shrinkage"]>[number];

function patchSupply(props: StepProps, next: ReconcileDraft): void {
  props.model.edit({
    supplies: props.draft.supplies.map((item) => (item.eventId === next.eventId ? next : item)),
  });
}

/** Step: leftovers to return and anything lost or damaged. Whole numbers use plus and minus. */
export function CloseSuppliesStep(props: StepProps) {
  const { model, draft, step, onNext } = props;
  const t = useT();
  const locale = useLocale();
  const lines = draft.supplies.flatMap((supply) =>
    model.state?.canReconcile
      ? supply.source.receipts
          .filter((receipt) => !receipt.voided)
          .flatMap((receipt) =>
            receipt.lines.map((line) => ({
              supply,
              lineId: line.id,
              sourceId: receipt.source_event_id,
            })),
          )
      : [],
  );
  return (
    <CloseFrame
      step={step}
      onBack={props.onBack}
      hasError={model.hasError}
      footer={
        <PrimaryButton
          icon={ArrowRight}
          label={t("field.action.next")}
          disabled={model.isBusy}
          onPress={onNext}
        />
      }
    >
      <StepQuestion
        title={t("field.close.suppliesQuestion")}
        hint={t("field.close.suppliesHint")}
      />
      {lines.length === 0 ? <InfoNotice tone="info" message={t("field.close.noSupplies")} /> : null}
      {lines.map(({ supply, lineId, sourceId }, index) => {
        const returned =
          supply.returns.find((line) => line.receiptLineId === lineId)?.returned ?? "";
        const lost: Shrinkage = supply.shrinkage?.find((line) => line.receiptLineId === lineId) ?? {
          receiptLineId: lineId,
          receiptSourceEventId: sourceId,
          quantity: "",
          reasonCode: "",
          reason: "",
        };
        const setReturned = (value: string) => {
          patchSupply(props, {
            ...supply,
            returns: [
              ...supply.returns.filter((line) => line.receiptLineId !== lineId),
              { receiptLineId: lineId, receiptSourceEventId: sourceId, returned: value },
            ],
          });
        };
        const setLost = (patch: Partial<Shrinkage>) => {
          patchSupply(props, {
            ...supply,
            shrinkage: [
              ...(supply.shrinkage ?? []).filter((line) => line.receiptLineId !== lineId),
              { ...lost, ...patch },
            ],
          });
        };
        const hasLoss = lost.quantity !== "" && Number(lost.quantity) !== 0;
        return (
          <View key={lineId} className="gap-3">
            <AppText variant="h2">{t("field.close.supply", { number: index + 1 })}</AppText>
            {Number.isInteger(Number(returned || "0")) ? (
              <Counter
                label={t("field.close.returned")}
                value={Number(returned || "0")}
                onChange={(value) => {
                  setReturned(String(value));
                }}
              />
            ) : (
              <ShiftField
                label={t("field.close.returned")}
                value={returned}
                decimal
                onChange={setReturned}
              />
            )}
            <Counter
              label={t("field.close.lost")}
              value={Number(lost.quantity || "0")}
              onChange={(value) => {
                setLost({ quantity: String(value) });
              }}
            />
            {hasLoss ? (
              <>
                <AppText variant="bodyStrong">{t("field.close.lostWhy")}</AppText>
                {(model.state?.reasons ?? []).map((item) => (
                  <ChoiceRow
                    key={item.code}
                    label={catalogLabel(item, locale)}
                    isSelected={lost.reasonCode === item.code}
                    onPress={() => {
                      setLost({ reasonCode: item.code });
                    }}
                  />
                ))}
                <ShiftField
                  label={t("field.close.lostDetail")}
                  value={lost.reason}
                  onChange={(reason) => {
                    setLost({ reason });
                  }}
                />
                <SecondaryButton
                  icon={Camera}
                  label={t(
                    supply.photos?.length ? "field.open.photoAgain" : "field.open.photoTake",
                  )}
                  disabled={model.isBusy}
                  onPress={() => {
                    model.capturePhoto(supply.eventId);
                  }}
                />
              </>
            ) : null}
          </View>
        );
      })}
    </CloseFrame>
  );
}
