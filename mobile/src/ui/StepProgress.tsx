import { View } from "react-native";

import { useT } from "../i18n/I18nProvider.tsx";

interface StepProgressProps {
  /** 1-based current step. */
  readonly current: number;
  readonly total: number;
}

/** Segmented wizard progress: done and current segments are filled blue, the rest are grey. */
export function StepProgress({ current, total }: StepProgressProps) {
  const t = useT();
  const steps = Array.from({ length: Math.max(total, 1) }, (_, index) => index + 1);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t("courier.progress.label", { current, total })}
      accessibilityValue={{ min: 0, max: total, now: current }}
      className="w-full flex-row gap-1.5"
    >
      {steps.map((step) => (
        <View
          key={step}
          className={`h-1.5 flex-1 rounded-full ${step <= current ? "bg-action" : "bg-line"}`}
        />
      ))}
    </View>
  );
}
