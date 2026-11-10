import { View } from "react-native";
import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { ChoiceRow } from "../field-ui/ChoiceRow.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import { IncidentNotice } from "../ovitrap-lifecycle/IncidentNotice.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { choose } from "./choices.ts";
import { needsOther } from "./domain.ts";
import { catalogLabel } from "./labels.ts";
import type { CaptureProps } from "./model.ts";

/** "¿Cómo la encontraste?": the finding of the downloaded list as big rows; choosing moves on. */
export function FindingPage(props: CaptureProps) {
  const { draft, model } = props;
  const t = useT();
  const locale = useLocale();
  return (
    <>
      <StepQuestion title={t("field.capture.findingQuestion")} />
      <View accessibilityRole="radiogroup" className="gap-3">
        {draft.catalog?.findings.map((item) => (
          <ChoiceRow
            key={item.code}
            label={catalogLabel(item, locale)}
            isSelected={draft.finding === item.code}
            disabled={model.isBusy}
            onPress={() => {
              choose(props, { finding: item.code });
            }}
          />
        ))}
      </View>
      <IncidentNotice finding={draft.finding} />
      {needsOther(draft) ? (
        <ShiftField
          label={t("field.capture.other")}
          disabled={model.isBusy}
          value={draft.otherText}
          onChange={(otherText) => {
            model.edit({ otherText }, draft.eventId);
          }}
        />
      ) : null}
    </>
  );
}
