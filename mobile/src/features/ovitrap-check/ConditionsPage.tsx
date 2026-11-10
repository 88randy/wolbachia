import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ChoiceRow } from "../field-ui/ChoiceRow.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import type { CaptureProps } from "./model.ts";

/** Optional extras: temperature, humidity, and "this reading is from an earlier week". */
export function ConditionsPage({ model, draft }: CaptureProps) {
  const t = useT();
  return (
    <>
      <StepQuestion
        title={t("field.capture.conditionsQuestion")}
        hint={t("field.capture.optional")}
      />
      <ShiftField
        label={t("field.capture.temperature")}
        value={draft.temperature}
        decimal
        disabled={model.isBusy}
        onChange={(temperature) => {
          model.edit({ temperature }, draft.eventId);
        }}
      />
      <ShiftField
        label={t("field.capture.humidity")}
        value={draft.humidity}
        decimal
        disabled={model.isBusy}
        onChange={(humidity) => {
          model.edit({ humidity }, draft.eventId);
        }}
      />
      <ChoiceRow
        label={t("field.capture.lagged")}
        isSelected={draft.isLagged}
        disabled={model.isBusy}
        onPress={() => {
          model.edit({ isLagged: !draft.isLagged }, draft.eventId);
        }}
      />
      {draft.isLagged ? <AppText tone="secondary">{t("field.capture.laggedHint")}</AppText> : null}
    </>
  );
}
