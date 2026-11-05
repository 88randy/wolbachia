import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { Modal, StyleSheet, View } from "react-native";

import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: "flex-end" },
    scrim: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: theme.color.navy,
      opacity: 0.55,
    },
    sheet: {
      backgroundColor: theme.color.surface,
      padding: spacing[2],
      gap: spacing[2],
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
    },
  });

export function ForgotPasswordSheet({
  isOpen,
  close,
}: {
  readonly isOpen: boolean;
  readonly close: () => void;
}) {
  const t = useT();
  const styles = useStyles(createStyles);
  return (
    <Modal transparent visible={isOpen} animationType="slide" onRequestClose={close}>
      <View style={styles.root}>
        <View style={styles.scrim} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <AppText variant="h2">{t("mobile.login.forgotPassword")}</AppText>
          <AppText>{t("mobile.login.callSupervisor")}</AppText>
          <Button variant="text" label={t("mobile.login.understood")} onPress={close} />
        </View>
      </View>
    </Modal>
  );
}
