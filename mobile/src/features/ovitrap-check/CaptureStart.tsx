import { MapPinPlus, ScanLine } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { ActionGrid } from "../../ui/ActionGrid.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import type { M08Model } from "./use-m-08.ts";

/** Nothing started: "Colocar" a new ovitrap or "Revisar" one by scanning its QR. */
export function CaptureStart({ model }: { readonly model: M08Model }) {
  const t = useT();
  const { push } = useNavigation();
  const canStart = model.state?.canStartCapture === true;
  return (
    <ScreenScaffold header={<AppHeader title={t("field.capture.title")} />}>
      <StepQuestion title={t("field.capture.startQuestion")} />
      <ActionGrid
        items={[
          {
            key: "place",
            icon: MapPinPlus,
            label: t("field.capture.place"),
            hint: t("field.capture.placeHint"),
            disabled: model.isBusy || !canStart,
            onPress: () => {
              void model.run(() => model.service.startPlace(null), {
                eventId: null,
                startsCapture: true,
              });
            },
          },
          {
            key: "check",
            icon: ScanLine,
            label: t("field.capture.check"),
            hint: t("field.capture.checkHint"),
            disabled: model.isBusy || !canStart,
            onPress: () => {
              push({ name: "ovitrapScanner", target: "ovitrap", eventId: null });
            },
          },
        ]}
      />
    </ScreenScaffold>
  );
}
