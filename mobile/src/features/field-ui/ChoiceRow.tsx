import { Check } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { KIT_ICON_STROKE } from "../../ui/kit-styles.ts";

export interface ChoiceRowProps {
  readonly label: string;
  readonly hint?: string;
  readonly icon?: LucideIcon;
  readonly isSelected: boolean;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}

function frame(isSelected: boolean, disabled: boolean): string {
  if (disabled) return "border-line bg-surface-muted";
  return isSelected ? "border-action bg-action" : "border-line-strong bg-surface";
}

/** One option of a pick-from-the-list step. Selected is filled blue with a check and "Elegido". */
export function ChoiceRow({
  label,
  hint,
  icon: IconComponent,
  isSelected,
  onPress,
  disabled = false,
}: ChoiceRowProps) {
  const t = useT();
  const { theme } = useTheme();
  const filled = isSelected && !disabled;
  const color = filled ? theme.color.onAction : theme.color.text.primary;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      accessibilityState={{ selected: isSelected, checked: isSelected, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-16 flex-row items-center gap-3 rounded-2xl border-2 px-4 py-3 active:opacity-80 ${frame(isSelected, disabled)}`}
    >
      {IconComponent ? (
        <IconComponent color={color} size={26} strokeWidth={KIT_ICON_STROKE} />
      ) : null}
      <View className="flex-1">
        <AppText variant="bodyStrong" style={{ color }}>
          {label}
        </AppText>
        {hint ? <AppText variant="caption" style={{ color }}>{hint}</AppText> : null}
      </View>
      {filled ? (
        <View className="flex-row items-center gap-1">
          <Check color={color} size={22} strokeWidth={3} />
          <AppText variant="captionStrong" style={{ color }}>
            {t("courier.choice.selected")}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}
