import { Undo2 } from "lucide-react-native";
import { View } from "react-native";
import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { ChoiceRow } from "../field-ui/ChoiceRow.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { catalogLabel } from "./labels.ts";
import type { CaptureProps } from "./model.ts";

/**
 * This ovitrap was already checked this week. Nothing is deleted: to check it again the courier
 * cancels the old one with a reason, and the new one is saved next to it.
 */
export function RepeatBlock({ model, draft }: CaptureProps) {
  const t = useT();
  const locale = useLocale();
  if (!model.state?.repeat) return null;
  if (!draft.replacesEventId)
    return (
      <>
        <InfoNotice tone="warning" message={t("field.capture.repeat")} />
        <SecondaryButton
          icon={Undo2}
          label={t("field.capture.correct")}
          disabled={model.isBusy}
          onPress={() => {
            void model.run(() => model.service.correct(draft.eventId), { eventId: draft.eventId });
          }}
        />
      </>
    );
  return (
    <>
      <InfoNotice tone="info" message={t("field.capture.correctHint")} />
      <View accessibilityRole="radiogroup" className="gap-3">
        {draft.catalog?.voidReasons.map((item) => (
          <ChoiceRow
            key={item.code}
            label={catalogLabel(item, locale)}
            isSelected={draft.reasonCode === item.code}
            disabled={model.isBusy}
            onPress={() => {
              model.edit({ reasonCode: item.code }, draft.eventId);
            }}
          />
        ))}
      </View>
      <ShiftField
        label={t("field.capture.correctWhy")}
        disabled={model.isBusy}
        value={draft.reason}
        onChange={(reason) => {
          model.edit({ reason }, draft.eventId);
        }}
      />
    </>
  );
}
