import { View } from "react-native";
import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { CaptureCommand } from "./CaptureCommand.tsx";
import { ShiftAction } from "../shift-open/ShiftAction.tsx";
import { reviewReasons } from "./validation.ts";
import type { CaptureProps } from "./model.ts";
const KEYS: Readonly<Record<string, MessageKey>> = {
  gps: "mobile.ovitrap.gps",
  stale: "mobile.ovitrap.stale",
  distance: "mobile.ovitrap.distance",
  location: "mobile.ovitrap.location",
};
export function ReviewNotice({ model, draft }: CaptureProps) {
  const t = useT();
  const reasons = reviewReasons(draft, new Date());
  return (
    <View>
      {reasons.map((reason) => (
        <Notice
          key={reason}
          tone="warning"
          icon="alert"
          message={t(KEYS[reason] ?? "mobile.ovitrap.gateReview")}
        />
      ))}
      {reasons.length ? (
        <ShiftAction
          label={t("mobile.ovitrap.acknowledge")}
          selected={draft.reviewAcknowledged}
          disabled={model.isBusy}
          onPress={() => {
            model.edit({ reviewAcknowledged: !draft.reviewAcknowledged });
          }}
        />
      ) : null}
      <CaptureCommand model={model} command="refreshGps" />
    </View>
  );
}
