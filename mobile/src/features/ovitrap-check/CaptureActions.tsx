import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { CaptureCommand } from "./CaptureCommand.tsx";
import type { M08Model } from "./use-m-08.ts";
export function CaptureActions({ model }: { readonly model: M08Model }) {
  const t = useT();
  const { push } = useNavigation();
  const eventId = model.state?.draft?.eventId ?? null;
  return (
    <View>
      <CaptureCommand eventId={eventId} model={model} command="startPlace" />
      <ShiftAction
        label={t("mobile.ovitrap.check")}
        disabled={model.isBusy || model.state?.canStartCapture !== true}
        onPress={() => {
          push({ name: "ovitrapScanner", target: "ovitrap", eventId });
        }}
      />
      <CaptureCommand eventId={eventId} model={model} command="refresh" />
      {model.state?.draft && !model.state.event ? (
        <CaptureCommand eventId={eventId} model={model} command="adoptSnapshots" />
      ) : null}
    </View>
  );
}
