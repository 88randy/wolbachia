import { Flag } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { CloseFrame } from "./CloseFrame.tsx";
import type { StepProps } from "./close-steps.ts";

/** Last step: the kilometers at the end, then "Cerrar jornada". */
export function CloseOdometerStep({ model, draft, step, onBack }: StepProps) {
  const t = useT();
  const opening = model.state?.opening?.envelope.payload as { odometer_km?: number } | undefined;
  const isLow = Number(draft.odometer) < (opening?.odometer_km ?? 0);
  return (
    <CloseFrame
      step={step}
      onBack={onBack}
      hasError={model.hasError}
      footer={
        <PrimaryButton
          icon={Flag}
          label={t("field.close.finish")}
          isLoading={model.isBusy}
          disabled={model.isBusy || !/^\d+$/.test(draft.odometer)}
          onPress={() => {
            void model.run(() => model.service.close());
          }}
        />
      }
    >
      <StepQuestion
        title={t("field.close.odometerQuestion")}
        hint={t("field.close.odometerHint")}
      />
      <ShiftField
        label={t("field.open.odometerKm")}
        value={draft.odometer}
        numeric
        disabled={model.isBusy}
        onChange={(odometer) => {
          model.edit({ odometer });
        }}
      />
      {isLow && draft.odometer !== "" ? (
        <InfoNotice tone="warning" message={t("field.open.odometerLow")} />
      ) : null}
      <ShiftField
        label={t("field.open.noteOptional")}
        value={draft.note}
        disabled={model.isBusy}
        onChange={(note) => {
          model.edit({ note });
        }}
      />
    </CloseFrame>
  );
}
