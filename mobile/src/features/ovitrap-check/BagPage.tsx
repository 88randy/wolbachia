import { QrCode } from "lucide-react-native";
import { View } from "react-native";
import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { ChoiceRow } from "../field-ui/ChoiceRow.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { needsOther } from "./domain.ts";
import { catalogLabel } from "./labels.ts";
import type { CaptureProps } from "./model.ts";

/** The paddle type from the list, then the bag: scan its QR (no typing). */
export function BagPage({ model, draft }: CaptureProps) {
  const t = useT();
  const locale = useLocale();
  const { push } = useNavigation();
  return (
    <>
      <StepQuestion title={t("field.capture.paddleTypeQuestion")} />
      <View accessibilityRole="radiogroup" className="gap-3">
        {draft.catalog?.paddleTypes.map((item) => (
          <ChoiceRow
            key={item.code}
            label={catalogLabel(item, locale)}
            isSelected={draft.paddleType === item.code}
            disabled={model.isBusy}
            onPress={() => {
              model.edit({ paddleType: item.code }, draft.eventId);
            }}
          />
        ))}
      </View>
      {needsOther(draft) ? (
        <ShiftField
          label={t("field.capture.other")}
          disabled={model.isBusy}
          value={draft.otherText}
          onChange={(otherText) => {
            model.edit({ otherText }, draft.eventId);
          }}
        />
      ) : null}
      <StepQuestion title={t("field.capture.bagQuestion")} hint={t("field.capture.bagHint")} />
      <SecondaryButton
        icon={QrCode}
        label={t(draft.bagCode ? "field.capture.bagAgain" : "field.capture.bagScan")}
        disabled={model.isBusy}
        onPress={() => {
          push({ name: "ovitrapScanner", target: "bag", eventId: draft.eventId });
        }}
      />
      {draft.bagCode ? (
        <InfoNotice tone="success" message={t("field.capture.bagReady")} />
      ) : (
        <AppText tone="secondary">{t("field.capture.bagMissing")}</AppText>
      )}
    </>
  );
}
