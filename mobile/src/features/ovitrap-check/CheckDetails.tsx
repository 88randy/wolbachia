import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { ConditionsFields } from "./ConditionsFields.tsx";
import { PaddleFields } from "./PaddleFields.tsx";
import { Preparation } from "./Preparation.tsx";
import { ReuseChoices } from "./ReuseChoices.tsx";
import type { CaptureProps } from "./model.ts";
export function CheckDetails(props: CaptureProps) {
  const { model, draft } = props;
  const t = useT();
  return (
    <View>
      <ConditionsFields {...props} />
      {draft.paddlePresent ? <PaddleFields {...props} /> : null}
      <Preparation {...props} />
      <ReuseChoices {...props} />
      <ShiftAction
        label={t("mobile.ovitrap.next")}
        disabled={model.isBusy}
        onPress={() => {
          void model.run(() => model.service.update({ step: "confirm" }, draft.eventId), {
            eventId: draft.eventId,
          });
        }}
      />
    </View>
  );
}
