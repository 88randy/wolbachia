import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { IncidentBody } from "./IncidentBody.tsx";
import { IncidentFeedback } from "./IncidentFeedback.tsx";
import { IncidentFooter } from "./IncidentFooter.tsx";
import { IncidentHistory } from "./IncidentHistory.tsx";
import { IncidentRefresh } from "./IncidentRefresh.tsx";
import { createIncidentStyles } from "./styles.ts";
import { useM12 } from "./use-m-12.ts";

export function P23Screen() {
  const model = useM12(),
    t = useT(),
    styles = useStyles(createIncidentStyles);
  return (
    <View style={styles.root}>
      <ScreenHeader
        largeTargets
        title={t("mobile.incidents.title")}
        subtitle={t("mobile.incidents.subtitle")}
      />
      <AppScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <IncidentFeedback model={model} />
        <IncidentBody model={model} kind="report" />
        <IncidentRefresh model={model} />
        <IncidentHistory model={model} />
      </AppScrollView>
      <IncidentFooter model={model} kind="report" />
    </View>
  );
}
