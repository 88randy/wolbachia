import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { ShiftField } from "../shift-open/ShiftField.tsx";
import { needsOther } from "./domain.ts";
import { ReasonChoices } from "./ReasonChoices.tsx";
import type { LifecycleProps } from "./model.ts";
export function LifecycleReason({ draft, model }: LifecycleProps) {
  const t = useT();
  return (
    <View>
      <ReasonChoices draft={draft} model={model} />
      {needsOther(draft) ? (
        <ShiftField
          label={t("mobile.lifecycle.other")}
          value={draft.otherText}
          disabled={model.isBusy}
          onChange={(otherText) => {
            model.edit({ otherText }, draft.eventId);
          }}
        />
      ) : null}
      {["abandoned", "removed"].includes(draft.reasonCode) ? (
        <Notice tone="info" icon="alert" message={t("mobile.lifecycle.incidentNotice")} />
      ) : null}
    </View>
  );
}
