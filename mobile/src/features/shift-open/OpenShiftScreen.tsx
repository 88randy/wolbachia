import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { SaveFeedback } from "./SaveFeedback.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { P4Screen } from "./P4Screen.tsx";
import { P5Screen } from "./P5Screen.tsx";
import { P6Screen } from "./P6Screen.tsx";
import { P7Screen } from "./P7Screen.tsx";
import { ShiftAction } from "./ShiftAction.tsx";
import { createShiftStyles } from "./styles.ts";
import { useM04 } from "./use-m-04.ts";
import type { M04Model } from "./use-m-04.ts";
function stepScreen(model: M04Model) {
  if (model.state?.opening) return <P7Screen model={model} />;
  switch (model.state?.draft?.step) {
    case "motorcycle":
      return <P4Screen model={model} />;
    case "checklist":
      return <P5Screen model={model} />;
    case "odometer":
      return <P6Screen model={model} />;
    case "maps":
      return <P7Screen model={model} />;
    default:
      return null;
  }
}
export function OpenShiftScreen() {
  const model = useM04();
  const t = useT();
  const styles = useStyles(createShiftStyles);
  return (
    <View style={styles.root}>
      <ScreenHeader title={t("mobile.shiftOpen.start")} />
      <AppScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SaveFeedback model={model} />
        {stepScreen(model)}
        {model.state?.opening ? null : (
          <ShiftAction
            label={t("mobile.shiftOpen.editChecklist")}
            disabled={model.isBusy}
            onPress={() => {
              void model.run(() => model.service.update({ step: "motorcycle" }));
            }}
          />
        )}
      </AppScrollView>
    </View>
  );
}
