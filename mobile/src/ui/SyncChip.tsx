import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";
import { Pressable, StyleSheet } from "react-native";

import { useT } from "../i18n/I18nProvider.tsx";
import { useNavigation } from "../navigation/NavigationProvider.tsx";
import { deriveChipState } from "../sync/chip-state.ts";
import { useSyncSnapshot } from "../sync/use-sync.ts";
import { useStyles, useTheme } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";
import { presentChip } from "./chip-presentation.ts";
import { Icon } from "./Icon.tsx";

/** Design: the chip is 48 dp high (`.chip`), a comfortable target next to the 44 dp minimum. */
const MIN_HEIGHT = 48;
const ICON_SIZE = 20;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    chip: {
      minHeight: MIN_HEIGHT,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing[0.5] + 2,
      paddingHorizontal: spacing[1.5],
      borderRadius: radius.xl + radius.sm,
    },
    success: { backgroundColor: theme.color.status.success.bg },
    warning: { backgroundColor: theme.color.status.warning.bg },
    critical: { backgroundColor: theme.color.status.critical.bg },
  });

/**
 * The sync indicator of the top bar: all sent, N to upload, no signal, or error. It opens the
 * inbox (P28); on the inbox itself it only reports. Its words double as the TalkBack label.
 */
export function SyncChip() {
  const styles = useStyles(createStyles);
  const { theme } = useTheme();
  const t = useT();
  const { route, push } = useNavigation();
  const { tone, icon, messageKey, params } = presentChip(deriveChipState(useSyncSnapshot()));
  const color = theme.color.status[tone].fg;
  const label = t(messageKey, params);
  const isInbox = route.name === "inbox";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={isInbox ? undefined : t("mobile.chip.hint")}
      disabled={isInbox}
      onPress={() => {
        push({ name: "inbox" });
      }}
      style={[styles.chip, styles[tone]]}
    >
      <Icon name={icon} color={color} size={ICON_SIZE} />
      <AppText variant="captionStrong" style={{ color }}>
        {label}
      </AppText>
    </Pressable>
  );
}
