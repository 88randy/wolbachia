import { View } from "react-native";
import { useT } from "../src/i18n/I18nProvider.tsx";
import { useStyles } from "../src/theme/ThemeProvider.tsx";
import { AppText } from "../src/ui/AppText.tsx";
import { AppScrollView } from "../src/ui/AppScrollView.tsx";
import { Badge } from "../src/ui/Badge.tsx";
import { HeaderBar } from "../src/ui/HeaderBar.tsx";
import { FuelBody } from "../src/features/fuel/FuelBody.tsx";
import { FuelFeedback } from "../src/features/fuel/FuelFeedback.tsx";
import { FuelFooter } from "../src/features/fuel/FuelFooter.tsx";
import { createFuelStyles } from "../src/features/fuel/styles.ts";
import { useFuelPreviewModel } from "./fuel-preview-model.js";

/** Actual P22 components; the fixture never imports services or native acquisition. */
export function FuelPreview() {
  const model = useFuelPreviewModel();
  const t = useT();
  const styles = useStyles(createFuelStyles);
  return (
    <View style={styles.root}>
      <HeaderBar title={t("mobile.fuel.title")}>
        <Badge tone="neutral" icon="phone" label={t("mobile.preview.sample")} />
      </HeaderBar>
      <AppScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <FuelFeedback model={model} />
        {model.previewHint ? (
          <AppText accessibilityLiveRegion="polite">{model.previewHint}</AppText>
        ) : null}
        <FuelBody model={model} />
      </AppScrollView>
      <FuelFooter model={model} />
    </View>
  );
}
