import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { LifecycleReason } from "./LifecycleReason.tsx";
import { LifecycleCommand } from "./LifecycleCommand.tsx";
import { LifecycleEvidence } from "./LifecycleEvidence.tsx";
import type { LifecycleProps } from "./model.ts";
export function LifecycleFields(props: LifecycleProps) {
  const { draft, model } = props;
  const t = useT();
  return (
    <View>
      <LifecycleReason {...props} />
      <LifecycleCommand model={model} eventId={draft.eventId} command="refreshGps" />
      <AppText>
        {t(draft.gps ? "mobile.lifecycle.gpsCaptured" : "mobile.lifecycle.gpsRequired")}
      </AppText>
      <LifecycleEvidence {...props} />
      <ShiftAction
        label={t("mobile.lifecycle.reviewAcknowledge")}
        selected={draft.reviewAcknowledged}
        disabled={model.isBusy}
        onPress={() => {
          model.edit({ reviewAcknowledged: !draft.reviewAcknowledged }, draft.eventId);
        }}
      />
    </View>
  );
}
