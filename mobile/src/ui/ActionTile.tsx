import type { LucideIcon } from "lucide-react-native";
import type { Theme } from "@wolbachia/tokens";
import { Pressable, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";
import { kitShadow, KIT_ICON_STROKE } from "./kit-styles.ts";

export type ActionTileTone = "default" | "danger";

export interface ActionTileProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onPress: () => void;
  /** Short second line (for example "2 por revisar"). */
  readonly hint?: string;
  readonly disabled?: boolean;
  /** `danger` is reserved for Emergencia. */
  readonly tone?: ActionTileTone;
}

function iconColor(theme: Theme, isDanger: boolean, disabled: boolean): string {
  if (disabled) return theme.color.text.tertiary;
  return isDanger ? theme.color.status.critical.fg : theme.color.action;
}

function tileClass(isDanger: boolean, disabled: boolean): string {
  const border = isDanger ? "border-danger" : "border-line";
  return `min-h-28 flex-1 gap-3 rounded-card border bg-surface p-4 active:opacity-80 ${border} ${disabled ? "opacity-60" : ""}`;
}

function TileIcon({
  icon: IconComponent,
  isDanger,
  disabled,
}: {
  readonly icon: LucideIcon;
  readonly isDanger: boolean;
  readonly disabled: boolean;
}) {
  const { theme } = useTheme();
  const box = isDanger ? "bg-danger-bg" : "bg-tint";
  return (
    <View className={`h-12 w-12 items-center justify-center rounded-xl ${box}`}>
      <IconComponent
        color={iconColor(theme, isDanger, disabled)}
        size={26}
        strokeWidth={KIT_ICON_STROKE}
      />
    </View>
  );
}

/** A tile of the home grid: big icon on a tinted square, verb below. Use two per row. */
export function ActionTile(props: ActionTileProps) {
  const { icon: IconComponent, label, hint, disabled = false } = props;
  const isDanger = props.tone === "danger";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={props.onPress}
      className={tileClass(isDanger, disabled)}
      style={kitShadow.card}
    >
      <TileIcon icon={IconComponent} isDanger={isDanger} disabled={disabled} />
      <View className="gap-0.5">
        <AppText variant="bodyStrong">{label}</AppText>
        {hint ? (
          <AppText variant="caption" tone="secondary">
            {hint}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}
