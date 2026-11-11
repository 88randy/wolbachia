import { displayPointCode } from "../day/point-code.ts";
import { MapPin } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { ChoiceRow } from "../field-ui/ChoiceRow.tsx";
import { StepQuestion } from "../field-ui/StepQuestion.tsx";
import type { CaptureProps } from "./model.ts";

function placeablePoints(draft: CaptureProps["draft"]) {
  const assignment = draft.assignment;
  const ids = assignment?.placePointIds;
  return assignment?.points.filter((point) => ids === undefined || ids.includes(point.id)) ?? [];
}

/** Placing a trap: pick the point of your route where it goes. */
export function PointPage({ model, draft }: CaptureProps) {
  const t = useT();
  return (
    <>
      <StepQuestion title={t("field.capture.pointQuestion")} />
      <View accessibilityRole="radiogroup" className="gap-3">
        {placeablePoints(draft).map((point) => (
          <ChoiceRow
            key={point.id}
            icon={MapPin}
            label={t("field.day.point", { code: displayPointCode(point.code) })}
            isSelected={draft.point?.id === point.id}
            disabled={model.isBusy}
            onPress={() => {
              model.edit({ point }, draft.eventId);
            }}
          />
        ))}
      </View>
    </>
  );
}
