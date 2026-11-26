import { CircleCheck, TriangleAlert } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { useT } from "../i18n/I18nProvider.tsx";
import { useTheme } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";
import { kitShadow, KIT_ICON_STROKE } from "./kit-styles.ts";

export type CheckValue = "good" | "fault";

export interface CheckRowProps {
  /** What is checked, for example "Frenos". */
  readonly label: string;
  readonly value: CheckValue | null;
  readonly onChange: (value: CheckValue) => void;
  /** Overrides "Bien" / "Con falla" when the item uses other words. */
  readonly goodLabel?: string;
  readonly faultLabel?: string;
  readonly disabled?: boolean;
}

interface SegmentSpec {
  readonly value: CheckValue;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly filled: string;
}

function Segment({
  spec,
  isSelected,
  onPress,
  disabled,
}: {
  readonly spec: SegmentSpec;
  readonly isSelected: boolean;
  readonly onPress: () => void;
  readonly disabled: boolean;
}) {
  const { theme } = useTheme();
  const color = isSelected ? theme.color.onAction : theme.color.text.primary;
  const IconComponent = spec.icon;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={spec.label}
      accessibilityState={{ selected: isSelected, checked: isSelected, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-14 flex-1 flex-row items-center justify-center gap-2 rounded-xl border-2 px-3 active:opacity-80 ${isSelected ? spec.filled : "border-line-strong bg-surface"}`}
    >
      <IconComponent color={color} size={22} strokeWidth={KIT_ICON_STROKE} />
      <AppText variant="bodyStrong" style={{ color }}>
        {spec.label}
      </AppText>
    </Pressable>
  );
}

function segmentSpecs(props: CheckRowProps, t: ReturnType<typeof useT>): readonly SegmentSpec[] {
  return [
    {
      value: "good",
      label: props.goodLabel ?? t("courier.check.good"),
      icon: CircleCheck,
      filled: "bg-success border-success",
    },
    {
      value: "fault",
      label: props.faultLabel ?? t("courier.check.fault"),
      icon: TriangleAlert,
      filled: "bg-danger border-danger",
    },
  ];
}

/** One checklist item with two filled answers: green "Bien" or red "Con falla", each with icon and text. */
export function CheckRow(props: CheckRowProps) {
  const specs = segmentSpecs(props, useT());
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={props.label}
      className="gap-3 rounded-card border border-line bg-surface p-4"
      style={kitShadow.card}
    >
      <AppText variant="bodyStrong">{props.label}</AppText>
      <View className="flex-row gap-3">
        {specs.map((spec) => (
          <Segment
            key={spec.value}
            spec={spec}
            isSelected={props.value === spec.value}
            disabled={props.disabled ?? false}
            onPress={() => {
              props.onChange(spec.value);
            }}
          />
        ))}
      </View>
    </View>
  );
}
