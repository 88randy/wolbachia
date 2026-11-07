import { View } from "react-native";
import { AppText } from "../../ui/AppText.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import type { M08Model } from "./use-m-08.ts";
import type { Evidence } from "./types.ts";

export function PendingPhoto({
  model,
  eventId,
  photo,
}: {
  model: M08Model;
  eventId: string;
  photo: Evidence;
}) {
  const t = useT();
  const undo = () => {
    void model.run(() => model.service.undoEvidence(eventId, photo.id), { eventId });
  };
  return (
    <View>
      <AppText>{photo.id}</AppText>
      <ShiftAction
        label={t("mobile.camera.undo")}
        disabled={model.isBusy || model.state?.event !== null || model.state.isShiftBlocked}
        onPress={undo}
      />
    </View>
  );
}
