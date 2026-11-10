import { View } from "react-native";
import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { FuelBody } from "./FuelBody.tsx";
import { FuelFooter } from "./FuelFooter.tsx";
import { FuelFeedback } from "./FuelFeedback.tsx";
import { FuelInboxLink } from "./FuelInboxLink.tsx";
import { createFuelStyles } from "./styles.ts";
import { useM11 } from "./use-m-11.ts";

/** P22 separates retained quantities, receipt transport and later server review. */
export function P22Screen() {
  const model = useM11();
  const t = useT();
  const styles = useStyles(createFuelStyles);
  return (
    <View style={styles.root}>
      <ScreenHeader
        largeTargets
        title={t("mobile.fuel.title")}
        subtitle={t("mobile.fuel.subtitle")}
      />
      <AppScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FuelFeedback model={model} />
        <FuelBody model={model} />
        <FuelInboxLink model={model} />
      </AppScrollView>
      <FuelFooter model={model} />
    </View>
  );
}
