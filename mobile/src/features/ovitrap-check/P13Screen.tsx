import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { PlacementPreparation } from "./PlacementPreparation.tsx";
import { PointChoices } from "./PointChoices.tsx";
import { Confirmation } from "./Confirmation.tsx";
import type { CaptureProps } from "./model.ts";
export function P13Screen(props: CaptureProps) {
  const { draft, model } = props;
  const t = useT();
  if (draft.step === "confirm") return <Confirmation {...props} />;
  return (
    <View>
      {draft.step === "point" ? <PointChoices {...props} /> : <PlacementPreparation {...props} />}
      <ShiftAction
        label={t("mobile.ovitrap.next")}
        disabled={model.isBusy || !draft.point}
        onPress={() => {
          void model.run(
            () =>
              model.service.update(
                { step: draft.step === "point" ? "prepare" : "confirm" },
                draft.eventId,
              ),
            { eventId: draft.eventId },
          );
        }}
      />
    </View>
  );
}
