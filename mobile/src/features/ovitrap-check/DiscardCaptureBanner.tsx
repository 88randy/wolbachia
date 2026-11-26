import { Trash2 } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { DISCARD_REMEDY } from "./discard-remedy.ts";
import type { CaptureProps } from "./model.ts";

/** "Descartar captura" right under the error, with an inline confirmation (no native alert). */
export function DiscardCaptureBanner({ model, draft }: CaptureProps) {
  const t = useT();
  const [isConfirming, setConfirming] = useState(false);
  if (model.errorKey === null || !DISCARD_REMEDY.includes(model.errorKey)) return null;
  if (!isConfirming)
    return (
      <SecondaryButton
        icon={Trash2}
        label={t("field.discard.action")}
        disabled={model.isBusy}
        onPress={() => {
          setConfirming(true);
        }}
      />
    );
  return (
    <View className="gap-3">
      <InfoNotice tone="warning" message={t("field.discard.confirm")} />
      <PrimaryButton
        tone="danger"
        icon={Trash2}
        label={t("field.discard.yes")}
        disabled={model.isBusy}
        onPress={() => {
          void model.run(() => model.service.discardStale(draft.eventId), {
            eventId: draft.eventId,
          });
        }}
      />
      <SecondaryButton
        label={t("field.action.cancel")}
        onPress={() => {
          setConfirming(false);
        }}
      />
    </View>
  );
}
