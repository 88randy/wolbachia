import { ArrowRight, CircleCheck, Route } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { kitShadow } from "../../ui/kit-styles.ts";
import { ChoiceRow } from "../field-ui/ChoiceRow.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { displayPointCode } from "../day/point-code.ts";
import { CloseFrame } from "./CloseFrame.tsx";
import type { StepProps } from "./close-steps.ts";

/** Step: which points of the route are still missing. Each is left for tomorrow on purpose. */
export function ClosePendingStep({ model, draft, step, onNext }: StepProps) {
  const t = useT();
  const { push } = useNavigation();
  const pending = model.state?.pending ?? [];
  const allSet = pending.every((point) => draft.dispositions[point.taskId] === "leave_pending");
  return (
    <CloseFrame
      step={step}
      hasError={model.hasError}
      footer={
        <PrimaryButton
          icon={ArrowRight}
          label={t("field.action.next")}
          disabled={model.isBusy || !allSet}
          onPress={onNext}
        />
      }
    >
      <StepQuestion title={t("field.close.pendingQuestion")} hint={t("field.close.pendingHint")} />
      {pending.length === 0 ? (
        <InfoNotice tone="success" icon={CircleCheck} message={t("field.close.nonePending")} />
      ) : null}
      {pending.map((point) => (
        <View
          key={point.taskId}
          className="gap-3 rounded-card border border-line bg-surface p-4"
          style={kitShadow.card}
        >
          <AppText variant="h2">
            {t("field.day.point", { code: displayPointCode(point.pointCode) })}
          </AppText>
          <SecondaryButton
            icon={Route}
            label={t("field.close.goNow")}
            onPress={() => {
              push({ name: "day" });
            }}
          />
          <ChoiceRow
            label={t("field.close.leave")}
            isSelected={draft.dispositions[point.taskId] === "leave_pending"}
            disabled={model.isBusy}
            onPress={() => {
              model.edit({
                dispositions: { ...draft.dispositions, [point.taskId]: "leave_pending" },
              });
            }}
          />
        </View>
      ))}
    </CloseFrame>
  );
}
