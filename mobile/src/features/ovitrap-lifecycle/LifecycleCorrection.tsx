import { Undo2 } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { ChoiceRow } from "../field-ui/ChoiceRow.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { catalogLabel } from "../ovitrap-check/labels.ts";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import type { LifecycleProps } from "./model.ts";
import { useLifecycleCorrection } from "./use-lifecycle-correction.ts";

/**
 * "Me equivoqué": nothing is deleted. The mistake is cancelled with a reason and a new action can
 * be made. Hidden until the courier asks for it.
 */
export function LifecycleCorrection(props: LifecycleProps) {
  const { model } = props;
  const t = useT();
  const locale = useLocale();
  const [isOpen, setOpen] = useState(false);
  const correction = useLifecycleCorrection(props);
  if (correction.isBlocked) return null;
  if (!isOpen)
    return (
      <SecondaryButton
        icon={Undo2}
        label={t("field.lifecycle.mistake")}
        onPress={() => {
          setOpen(true);
        }}
      />
    );
  return (
    <>
      <StepQuestion
        title={t("field.lifecycle.mistakeQuestion")}
        hint={t("field.lifecycle.mistakeHint")}
      />
      <View accessibilityRole="radiogroup" className="gap-3">
        {(model.state?.correctionReasons ?? []).map((item) => (
          <ChoiceRow
            key={item.code}
            label={catalogLabel(item, locale)}
            isSelected={correction.reasonCode === item.code}
            disabled={model.isBusy}
            onPress={() => {
              correction.setCode(item.code);
            }}
          />
        ))}
      </View>
      {correction.policy ? (
        <InfoNotice
          tone="info"
          message={t("field.lifecycle.reasonLimits", {
            min: correction.policy.minimum,
            max: correction.policy.maximum,
          })}
        />
      ) : null}
      <ShiftField
        label={t("field.lifecycle.mistakeWhy")}
        value={correction.reason}
        disabled={model.isBusy}
        onChange={correction.setReason}
      />
      <SecondaryButton
        icon={Undo2}
        label={t("field.lifecycle.mistakeSend")}
        disabled={correction.disabled}
        onPress={correction.correct}
      />
    </>
  );
}
