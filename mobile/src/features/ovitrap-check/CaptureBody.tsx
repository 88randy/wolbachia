import { requiresPhoto } from "./validation.ts";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { P13Screen } from "./P13Screen.tsx";
import { P14Screen } from "./P14Screen.tsx";
import { RepeatCheck } from "./RepeatCheck.tsx";
import { EvidenceCapture } from "./EvidenceCapture.tsx";
import { needsOther } from "./domain.ts";
import type { CaptureProps } from "./model.ts";
export function CaptureBody(props: CaptureProps) {
  const { draft, model } = props;
  const t = useT();
  const isRepeatBlocked = model.state?.repeat && !draft.replacesEventId;
  return (
    <View>
      {model.state?.repeat ? <RepeatCheck {...props} /> : null}
      {!isRepeatBlocked ? (
        <View>
          {needsOther(draft) ? (
            <ShiftField
              label={t("mobile.ovitrap.other")}
              value={draft.otherText}
              onChange={(otherText) => {
                model.edit({ otherText });
              }}
            />
          ) : null}
          {draft.mode === "place" ? <P13Screen {...props} /> : <P14Screen {...props} />}
          {requiresPhoto(draft) ? <EvidenceCapture {...props} /> : null}
        </View>
      ) : null}
    </View>
  );
}
