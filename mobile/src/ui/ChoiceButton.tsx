import { Check } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { useT } from "../i18n/I18nProvider.tsx";
import { useTheme } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";
import { KIT_ICON_STROKE } from "./kit-styles.ts";

/** `yes` fills green, `no` fills red, `neutral` fills blue when selected. */
export type ChoiceTone = "yes" | "no" | "neutral";

export interface ChoiceButtonProps {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly isSelected: boolean;
  readonly onPress: () => void;
  readonly tone?: ChoiceTone;
  readonly disabled?: boolean;
}

const FILLED: Readonly<Record<ChoiceTone, string>> = {
  yes: "bg-success border-success",
  no: "bg-danger border-danger",
  neutral: "bg-action border-action",
};

function SelectedMark() {
  const { theme } = useTheme();
  return (
    <View className="absolute right-3 top-3 h-7 w-7 items-center justify-center rounded-full bg-surface">
      <Check color={theme.color.text.primary} size={18} strokeWidth={3} />
    </View>
  );
}

/**
 * Huge Yes/No answer (for example "¿Tiene huevos?"). Selected is clearly FILLED with a check mark
 * and the word "Elegido"; never only an outline. Put two side by side.
 */
export function ChoiceButton(props: ChoiceButtonProps) {
  const { icon: IconComponent, isSelected, tone = "neutral", disabled = false } = props;
  const t = useT();
  const { theme } = useTheme();
  const color = isSelected ? theme.color.onAction : theme.color.text.primary;
  const frame = isSelected ? FILLED[tone] : "border-line-strong bg-surface";
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={props.label}
      accessibilityState={{ selected: isSelected, checked: isSelected, disabled }}
      disabled={disabled}
      onPress={props.onPress}
      className={`min-h-32 flex-1 items-center justify-center gap-2 rounded-card border-2 p-4 active:opacity-80 ${frame} ${disabled ? "opacity-60" : ""}`}
    >
      {isSelected ? <SelectedMark /> : null}
      <IconComponent color={color} size={40} strokeWidth={KIT_ICON_STROKE} />
      <AppText variant="h2" style={{ color }}>
        {props.label}
      </AppText>
      {isSelected ? (
        <AppText variant="captionStrong" style={{ color }}>
          {t("courier.choice.selected")}
        </AppText>
      ) : null}
    </Pressable>
  );
}
