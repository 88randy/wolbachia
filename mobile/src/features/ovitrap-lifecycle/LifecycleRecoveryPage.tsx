import { CircleCheck, CircleHelp, CircleX } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { ChoiceButton } from "../../ui/ChoiceButton.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import type { LifecycleProps } from "./model.ts";
import type { RecoveryState } from "./types.ts";

const OPTIONS: readonly {
  readonly value: RecoveryState;
  readonly icon: LucideIcon;
  readonly tone: "yes" | "no" | "neutral";
}[] = [
  { value: "recovered", icon: CircleCheck, tone: "yes" },
  { value: "unrecovered", icon: CircleX, tone: "no" },
  { value: "unconfirmed", icon: CircleHelp, tone: "neutral" },
];

/** Retiring a trap: did you get the trap back? Three huge answers. */
export function LifecycleRecoveryPage({ model, draft }: LifecycleProps) {
  const t = useT();
  return (
    <>
      <StepQuestion title={t("field.lifecycle.recoveryQuestion")} />
      <View className="gap-3">
        {OPTIONS.map(({ value, icon, tone }) => (
          <View key={value} className="flex-row">
            <ChoiceButton
              icon={icon}
              tone={tone}
              label={t(`field.lifecycle.recovery.${value}`)}
              isSelected={draft.recovery === value}
              disabled={model.isBusy}
              onPress={() => {
                model.edit({ recovery: value }, draft.eventId);
              }}
            />
          </View>
        ))}
      </View>
      {draft.recovery && draft.recovery !== "recovered" ? (
        <InfoNotice tone="warning" message={t("field.lifecycle.recoveryNotice")} />
      ) : null}
    </>
  );
}
