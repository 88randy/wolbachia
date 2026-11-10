import { Pressable } from "react-native";
import { spacing } from "@wolbachia/tokens";
import { useStyles, useTheme } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Icon } from "../../ui/Icon.tsx";
import type { IconName } from "../../ui/icon-paths.ts";
import { createIncidentStyles } from "./styles.ts";

export function EmergencyAction(props: {
  readonly label: string;
  readonly icon: IconName;
  readonly disabled?: boolean;
  readonly onPress: () => void;
}) {
  const styles = useStyles(createIncidentStyles),
    { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: props.disabled ?? false }}
      disabled={props.disabled ?? false}
      style={[styles.emergency, props.disabled ? styles.disabled : null]}
      onPress={props.onPress}
    >
      <Icon name={props.icon} size={spacing[6]} color={theme.color.status.critical.fg} />
      <AppText variant="h2" style={styles.emergencyLabel}>
        {props.label}
      </AppText>
    </Pressable>
  );
}
