import { ArrowRight } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { OdometerPhotoButton } from "./OdometerPhotoButton.tsx";
import { OpenFrame } from "./OpenFrame.tsx";
import { ShiftField } from "./ShiftField.tsx";
import type { M04Model } from "./use-m-04.ts";

const WHOLE_NUMBER = /^\d+$/;

/** Step 3 of 4: photo of the odometer and the kilometers it shows. */
export function P6Screen({ model }: { readonly model: M04Model }) {
  const t = useT();
  const draft = model.state?.draft;
  if (!draft) return null;
  const needsPhoto =
    Boolean(model.state?.catalog?.items.some((item) => item.requires_photo)) ||
    draft.checks.some((check) => check.result === "minor");
  const isReady =
    WHOLE_NUMBER.test(draft.odometer_km) && (!needsPhoto || draft.photoRefs.length > 0);
  const last = model.state?.lastOdometer ?? null;
  return (
    <OpenFrame
      model={model}
      step="odometer"
      footer={
        <PrimaryButton
          icon={ArrowRight}
          label={t("field.action.next")}
          disabled={model.isBusy || !isReady}
          onPress={() => {
            void model.run(() => model.service.update({ step: "maps" }));
          }}
        />
      }
    >
      <StepQuestion title={t("field.open.odometerQuestion")} hint={t("field.open.odometerHint")} />
      <OdometerPhotoButton model={model} />
      {needsPhoto && draft.photoRefs.length === 0 ? (
        <InfoNotice tone="warning" message={t("field.open.photoRequired")} />
      ) : null}
      <ShiftField
        label={t("field.open.odometerKm")}
        value={draft.odometer_km}
        numeric
        onChange={(odometer_km) => {
          model.edit({ odometer_km });
        }}
      />
      {last === null ? null : (
        <AppText tone="secondary">{t("field.open.odometerLast", { km: last })}</AppText>
      )}
      {model.state?.hasOdometerWarning ? (
        <InfoNotice tone="warning" message={t("field.open.odometerLow")} />
      ) : null}
      <ShiftField
        label={t("field.open.noteOptional")}
        value={draft.note}
        onChange={(note) => {
          model.edit({ note });
        }}
      />
    </OpenFrame>
  );
}
