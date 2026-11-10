import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppScrollView } from "../../ui/AppScrollView.tsx";
import { ScreenHeader } from "../../ui/ScreenHeader.tsx";
import { ReleaseContent } from "./ReleaseContent.tsx";
import { ReleaseFooter } from "./ReleaseFooter.tsx";
import { createReleaseStyles } from "./styles.ts";
import { hasBlockedReleaseGate } from "./view-model.ts";
import type { ReleaseViewModel } from "./view-model.ts";

/** P18/P19 present local prerequisites separately from the server's retained verdict. */
export function ReleaseView({ model }: { readonly model: ReleaseViewModel }) {
  const t = useT();
  const styles = useStyles(createReleaseStyles);
  const titleKey =
    model.status === "draft" && hasBlockedReleaseGate(model.gates)
      ? "mobile.release.blockedTitle"
      : "mobile.release.title";
  return (
    <View style={styles.root}>
      <ScreenHeader largeTargets title={t(titleKey)} subtitle={t("mobile.release.subtitle")} />
      <AppScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ReleaseContent model={model} />
      </AppScrollView>
      <ReleaseFooter model={model} />
    </View>
  );
}
