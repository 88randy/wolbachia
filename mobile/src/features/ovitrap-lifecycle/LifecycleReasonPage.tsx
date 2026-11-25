import { CloudOff, RotateCw } from "lucide-react-native";
import { View } from "react-native";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { ChoiceRow } from "../field-ui/ChoiceRow.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { catalogLabel } from "../ovitrap-check/labels.ts";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { IncidentNotice } from "./IncidentNotice.tsx";
import { needsOther } from "./domain.ts";
import type { LifecycleProps } from "./model.ts";

/** The list never reached this phone: say so and offer to download it again. */
function NoReasons({ model, draft }: LifecycleProps) {
  const t = useT();
  return (
    <EmptyState
      icon={CloudOff}
      title={t("field.lifecycle.noReasons")}
      message={t("field.lifecycle.noReasonsHint")}
      actionLabel={t("field.action.retry")}
      actionIcon={RotateCw}
      onAction={() => {
        void model.run(() => model.service.updateConfiguration(draft.eventId), draft.eventId);
      }}
    />
  );
}

function ReasonRows({ model, draft }: LifecycleProps) {
  const locale = useLocale();
  return (
    <View accessibilityRole="radiogroup" className="gap-3">
      {(draft.catalog?.[draft.kind] ?? []).map((item) => (
        <ChoiceRow
          key={item.code}
          label={catalogLabel(item, locale)}
          isSelected={draft.reasonCode === item.code}
          disabled={model.isBusy}
          onPress={() => {
            model.edit({ reasonCode: item.code, otherText: "" }, draft.eventId);
          }}
        />
      ))}
    </View>
  );
}

/** "¿Por qué?": the reasons of the downloaded list as big rows; "Otro" asks for a few words. */
export function LifecycleReasonPage({ model, draft }: LifecycleProps) {
  const t = useT();
  if (!draft.catalog?.[draft.kind].length) return <NoReasons model={model} draft={draft} />;
  return (
    <>
      <StepQuestion title={t(`field.lifecycle.reason.${draft.kind}`)} />
      <ReasonRows model={model} draft={draft} />
      {needsOther(draft) ? (
        <ShiftField
          label={t("field.lifecycle.other")}
          value={draft.otherText}
          disabled={model.isBusy}
          onChange={(otherText) => {
            model.edit({ otherText }, draft.eventId);
          }}
        />
      ) : null}
      <IncidentNotice finding={draft.reasonCode} />
    </>
  );
}
