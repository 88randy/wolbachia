import type { Theme } from "@wolbachia/tokens";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles, useTheme } from "../../theme/ThemeProvider.tsx";
import { Badge } from "../Badge.tsx";
import { BottomActions } from "../BottomActions.tsx";
import { Button } from "../Button.tsx";
import { HeaderBar } from "../HeaderBar.tsx";
import { IconButton } from "../IconButton.tsx";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.color.background },
  });

export function PreviewFrame({
  children,
  onBack,
}: {
  readonly children: ReactNode;
  readonly onBack: () => void;
}) {
  const t = useT();
  const styles = useStyles(createStyles);
  const { theme } = useTheme();
  return (
    <View style={styles.root}>
      <HeaderBar title={t("mobile.preview.title")}>
        <Badge tone="neutral" icon="phone" label={t("mobile.preview.sample")} />
        <IconButton
          icon="left"
          label={t("mobile.nav.back")}
          color={theme.color.text.primary}
          onPress={onBack}
        />
      </HeaderBar>
      {children}
      <BottomActions>
        <Button icon="check" label={t("mobile.preview.primary")} onPress={onBack} />
      </BottomActions>
    </View>
  );
}
