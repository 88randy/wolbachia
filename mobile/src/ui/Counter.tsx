import { Minus, Plus } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { useT } from "../i18n/I18nProvider.tsx";
import { useTheme } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";
import { kitShadow } from "./kit-styles.ts";

export interface CounterProps {
  /** What is counted, for example "Bolsas entregadas". Never used for eggs. */
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  /** Upper limit from the downloaded rules, never hard-coded in a screen. */
  readonly max?: number;
  readonly step?: number;
  readonly unit?: string;
}

interface StepButtonProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly disabled: boolean;
  readonly onPress: () => void;
}

function StepButton({ icon: IconComponent, label, disabled, onPress }: StepButtonProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`h-16 w-16 items-center justify-center rounded-2xl border-2 active:opacity-70 ${disabled ? "border-line bg-surface-muted" : "border-action bg-tint"}`}
    >
      <IconComponent
        color={disabled ? theme.color.text.tertiary : theme.color.action}
        size={30}
        strokeWidth={3}
      />
    </Pressable>
  );
}

function CounterValue({ text }: { readonly text: string }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      className="min-h-16 flex-1 items-center justify-center rounded-2xl bg-surface-muted"
    >
      <AppText variant="number">{text}</AppText>
    </View>
  );
}

/** Big minus / number / plus control for quantities (people, bags, units). */
export function Counter({ label, value, onChange, min = 0, max, step = 1, unit }: CounterProps) {
  const t = useT();
  const shown = unit ? `${String(value)} ${unit}` : String(value);
  return (
    <View className="gap-3 rounded-card border border-line bg-surface p-4" style={kitShadow.card}>
      <AppText variant="bodyStrong">{label}</AppText>
      <View className="flex-row items-center gap-3">
        <StepButton
          icon={Minus}
          label={t("courier.counter.decrease", { label })}
          disabled={value - step < min}
          onPress={() => {
            onChange(value - step);
          }}
        />
        <CounterValue text={shown} />
        <StepButton
          icon={Plus}
          label={t("courier.counter.increase", { label })}
          disabled={max !== undefined && value + step > max}
          onPress={() => {
            onChange(value + step);
          }}
        />
      </View>
    </View>
  );
}
