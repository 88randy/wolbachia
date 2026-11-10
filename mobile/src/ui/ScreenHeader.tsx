import { spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "../i18n/I18nProvider.tsx";
import { useNavigation } from "../navigation/NavigationProvider.tsx";
import { useStyles, useTheme } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";
import { IconButton } from "./IconButton.tsx";
import { SyncChip } from "./SyncChip.tsx";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    header: {
      backgroundColor: theme.color.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.soft,
      paddingBottom: spacing[1.5],
      paddingRight: spacing[2],
      paddingLeft: spacing[1],
    },
    row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing[0.5] },
    title: { flexGrow: 1, flexBasis: spacing[6] * 2 },
  });

interface ScreenHeaderProps {
  readonly largeTargets?: boolean;
  readonly title: string;
  readonly subtitle?: string;
}

/** Header of the inner screens (design `.fh`): back button, title, and the sync chip. */
export function ScreenHeader({ title, subtitle, largeTargets = false }: ScreenHeaderProps) {
  const styles = useStyles(createStyles);
  const { theme } = useTheme();
  const t = useT();
  const { goBack } = useNavigation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing[1] }]}>
      <View style={styles.row}>
        <IconButton
          {...{ largeTarget: largeTargets, icon: "left" }}
          label={t("mobile.nav.back")}
          color={theme.color.text.primary}
          onPress={goBack}
        />
        <View style={styles.title}>
          <AppText variant="button" accessibilityRole="header">
            {title}
          </AppText>
          {subtitle === undefined ? null : (
            <AppText variant="caption" tone="secondary">
              {subtitle}
            </AppText>
          )}
        </View>
        <SyncChip largeTarget={largeTargets} />
      </View>
    </View>
  );
}
