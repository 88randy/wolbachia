import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { EmergencyContact } from "./EmergencyContact.tsx";
import { IncidentBody } from "./IncidentBody.tsx";
import { IncidentFeedback } from "./IncidentFeedback.tsx";
import { IncidentFooter } from "./IncidentFooter.tsx";
import { IncidentRefresh } from "./IncidentRefresh.tsx";
import { createIncidentStyles } from "./styles.ts";
import { useM12 } from "./use-m-12.ts";

export function P24Screen() {
  const model = useM12(),
    t = useT(),
    styles = useStyles(createIncidentStyles),
    { push } = useNavigation();
  return (
    <View style={styles.root}>
      <ScreenHeader
        largeTargets
        title={t("mobile.incidents.emergency")}
        subtitle={t("mobile.incidents.emergencyHint")}
      />
      <AppScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <EmergencyContact model={model} />
        <IncidentFeedback model={model} />
        <IncidentBody model={model} kind="accident" />
        <IncidentRefresh model={model} />
      </AppScrollView>
      <IncidentFooter
        model={model}
        kind="accident"
        closeShift={() => {
          push({ name: "closeShift" });
        }}
      />
    </View>
  );
}
