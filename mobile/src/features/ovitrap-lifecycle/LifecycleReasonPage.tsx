import { View } from "react-native";
import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { ChoiceRow } from "../field-ui/ChoiceRow.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { catalogLabel } from "../ovitrap-check/labels.ts";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { IncidentNotice } from "./IncidentNotice.tsx";
import { needsOther } from "./domain.ts";
import type { LifecycleProps } from "./model.ts";

/** "¿Por qué?": the reasons of the downloaded list as big rows; "Otro" asks for a few words. */
export function LifecycleReasonPage({ model, draft }: LifecycleProps) {
  const t = useT();
  const locale = useLocale();
  const items = draft.catalog?.[draft.kind] ?? [];
  return (
    <>
      <StepQuestion title={t(`field.lifecycle.reason.${draft.kind}`)} />
      <View accessibilityRole="radiogroup" className="gap-3">
        {items.map((item) => (
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
