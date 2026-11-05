import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { Preparation } from "./Preparation.tsx";
import { ReuseChoices } from "./ReuseChoices.tsx";
import { EvidenceCapture } from "./EvidenceCapture.tsx";
import type { CaptureProps } from "./model.ts";
export function PlacementPreparation(props: CaptureProps) {
  const { model, draft } = props;
  const t = useT();
  return (
    <View>
      <Preparation {...props} />
      <ReuseChoices {...props} />
      <ShiftField
        label={t("mobile.ovitrap.supplies")}
        value={draft.supplyRefs.join(",")}
        onChange={(value) => {
          model.edit(
            { supplyRefs: value ? value.split(",").map((ref) => ref.trim()) : [] },
            draft.eventId,
          );
        }}
      />
      <EvidenceCapture {...props} />
    </View>
  );
}
