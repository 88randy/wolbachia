import { StyleSheet, Pressable } from "react-native";

import { Icon } from "./Icon.tsx";
import type { IconName } from "./icon-paths.ts";

/** Design: icon buttons are 48 x 48 (`.ib` in codequim.css), above the 44 dp touch target minimum. */
const SIZE = 48;
const ICON_SIZE = 24;

const styles = StyleSheet.create({
  button: { width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" },
});

interface IconButtonProps {
  readonly icon: IconName;
  /** Read by TalkBack. Required: an icon alone says nothing. */
  readonly label: string;
  readonly color: string;
  readonly onPress: () => void;
}

export function IconButton({ icon, label, color, onPress }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.button}
    >
      <Icon name={icon} color={color} size={ICON_SIZE} />
    </Pressable>
  );
}
