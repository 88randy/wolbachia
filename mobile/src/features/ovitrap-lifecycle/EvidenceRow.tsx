import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import type { LifecycleProps } from "./model.ts";
export function EvidenceRow({ id, draft, model }: LifecycleProps & { readonly id: string }) {
  const t = useT();
  return (
    <View>
      <AppText>{id}</AppText>
      <ShiftAction
        label={t("mobile.lifecycle.discardPhoto")}
        disabled={model.isBusy}
        onPress={() => {
          void model.run(() => model.service.removeEvidence(id, draft.eventId), draft.eventId);
        }}
      />
    </View>
  );
}
