import { QrCode } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import type { CaptureProps } from "./model.ts";

/** Placing: scan the sticker of the new ovitrap; its code is the identity of the trap. */
export function LabelPage({ model, draft }: CaptureProps) {
  const t = useT();
  const { push } = useNavigation();
  return (
    <>
      <StepQuestion title={t("field.capture.labelQuestion")} hint={t("field.capture.labelHint")} />
      <SecondaryButton
        icon={QrCode}
        label={t(draft.labelScanned ? "field.capture.labelAgain" : "field.capture.labelScan")}
        disabled={model.isBusy}
        onPress={() => {
          push({ name: "ovitrapScanner", target: "label", eventId: draft.eventId });
        }}
      />
      {draft.labelScanned ? (
        <InfoNotice tone="success" message={t("field.capture.labelReady")} />
      ) : (
        <AppText tone="secondary">{t("field.capture.labelMissing")}</AppText>
      )}
    </>
  );
}
