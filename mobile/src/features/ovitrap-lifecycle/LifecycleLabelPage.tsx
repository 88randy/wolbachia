import { QrCode } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { newLabelMessage } from "./labels.ts";
import type { LifecycleProps } from "./model.ts";

/** Replacing: scan (or type) the sticker of the new ovitrap, exactly as when placing one. */
export function LifecycleLabelPage({ model, draft }: LifecycleProps) {
  const t = useT();
  const { push } = useNavigation();
  return (
    <>
      <StepQuestion
        title={t("field.lifecycle.labelQuestion")}
        hint={t("field.capture.labelHint")}
      />
      <SecondaryButton
        icon={QrCode}
        label={t(draft.labelScanned ? "field.capture.labelAgain" : "field.capture.labelScan")}
        disabled={model.isBusy}
        onPress={() => {
          push({ name: "ovitrapScanner", target: "replacementLabel", eventId: draft.eventId });
        }}
      />
      {draft.labelScanned ? (
        <InfoNotice tone="success" message={newLabelMessage(t, draft)} />
      ) : (
        <AppText tone="secondary">{t("field.capture.labelMissing")}</AppText>
      )}
    </>
  );
}
