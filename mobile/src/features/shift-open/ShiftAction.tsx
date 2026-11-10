import { Check } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { KIT_ICON_STROKE } from "../../ui/kit-styles.ts";

interface Props {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly selected?: boolean;
}

function frame(disabled: boolean, selected: boolean | undefined): string {
  if (disabled) return "border-line bg-surface-muted";
  return selected ? "border-action bg-action" : "border-line-strong bg-surface";
}

/**
 * Option button of the courier flows: 56 dp minimum, wrapping text. Selected is FILLED blue with a
 * check mark (never only an outline), so it reads the same in every wizard.
 */
export function ShiftAction({ label, onPress, disabled = false, selected }: Props) {
  const { theme } = useTheme();
  const color = selected && !disabled ? theme.color.onAction : theme.color.text.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-14 flex-row items-center justify-center gap-2 rounded-2xl border-2 px-4 py-3 active:opacity-80 ${frame(disabled, selected)}`}
    >
      {selected ? (
        <View accessible={false} importantForAccessibility="no-hide-descendants">
          <Check color={color} size={22} strokeWidth={KIT_ICON_STROKE + 0.5} />
        </View>
      ) : null}
      <AppText variant="button" style={{ color, flexShrink: 1 }}>
        {label}
      </AppText>
    </Pressable>
  );
}
