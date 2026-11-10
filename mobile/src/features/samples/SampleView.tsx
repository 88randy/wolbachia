import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { SampleContent } from "./SampleContent.tsx";
import { SampleFooter } from "./SampleFooter.tsx";
import { createSampleStyles } from "./styles.ts";
import type { SampleViewModel } from "./view-model.ts";

/** P20 renders retained local facts; server ingestion and lab reception remain distinct. */
export function SampleView({ model }: { readonly model: SampleViewModel }) {
  const t = useT();
  const styles = useStyles(createSampleStyles);
  return (
    <View style={styles.root}>
      <ScreenHeader
        largeTargets
        title={t("mobile.sample.title")}
        subtitle={t("mobile.sample.subtitle")}
      />
      <AppScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SampleContent model={model} />
      </AppScrollView>
      <SampleFooter model={model} />
    </View>
  );
}
