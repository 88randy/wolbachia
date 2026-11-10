import { spacing } from "@wolbachia/tokens";
import { StyleSheet } from "react-native";

import { useT } from "../../i18n/I18nProvider.tsx";
import type { ColorScheme } from "../../theme/ThemeProvider.tsx";
import { AppScrollView } from "../AppScrollView.tsx";
import { AppText } from "../AppText.tsx";
import { PreviewAppearance } from "./PreviewAppearance.tsx";
import { PreviewCards } from "./PreviewCards.tsx";
import { PreviewFields } from "./PreviewFields.tsx";
import { PreviewFrame } from "./PreviewFrame.tsx";
import { PreviewStates } from "./PreviewStates.tsx";

const styles = StyleSheet.create({ content: { padding: spacing[2], gap: spacing[2] } });

export function PreviewContent({
  scheme,
  onToggleScheme,
  onBack,
}: {
  readonly scheme: ColorScheme;
  readonly onToggleScheme: () => void;
  readonly onBack: () => void;
}) {
  const t = useT();
  return (
    <PreviewFrame onBack={onBack}>
      <AppScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText tone="secondary">{t("mobile.preview.intro")}</AppText>
        <PreviewAppearance scheme={scheme} onToggleScheme={onToggleScheme} />
        <PreviewCards />
        <PreviewFields />
        <PreviewStates />
      </AppScrollView>
    </PreviewFrame>
  );
}
