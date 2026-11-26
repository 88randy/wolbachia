import { MapPin } from "lucide-react-native";
import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { ChoiceRow } from "../field-ui/ChoiceRow.tsx";
import type { CaptureProps } from "./model.ts";
import { reviewReasons } from "./validation.ts";

const REVIEW_KEYS: Readonly<Record<string, MessageKey>> = {
  gps: "field.capture.review.gps",
  stale: "field.capture.review.stale",
  distance: "field.capture.review.distance",
  location: "field.capture.review.location",
};

function reasonMessage(reason: string, draft: CaptureProps["draft"], t: ReturnType<typeof useT>) {
  const accuracy = draft.gps?.accuracy_m;
  if (reason === "gps" && typeof accuracy === "number" && accuracy > 0)
    return t("field.capture.review.gpsApprox", { meters: Math.round(accuracy) });
  return t(REVIEW_KEYS[reason] ?? "field.capture.review.gps");
}

/** Why the office will look at this capture (location, old rules) and the one tap to accept that. */
export function ReviewBlock({ model, draft }: CaptureProps) {
  const t = useT();
  const reasons = reviewReasons(draft, new Date());
  return (
    <>
      {reasons.map((reason) => (
        <InfoNotice key={reason} tone="warning" message={reasonMessage(reason, draft, t)} />
      ))}
      {reasons.length > 0 ? (
        <ChoiceRow
          label={t("field.capture.acknowledge")}
          isSelected={draft.reviewAcknowledged}
          disabled={model.isBusy}
          onPress={() => {
            model.edit({ reviewAcknowledged: !draft.reviewAcknowledged }, draft.eventId);
          }}
        />
      ) : null}
      {reasons.includes("gps") || reasons.includes("distance") ? (
        <SecondaryButton
          icon={MapPin}
          label={t("field.lifecycle.gpsRetry")}
          disabled={model.isBusy || model.state?.isShiftBlocked !== false}
          onPress={() => {
            void model.run(() => model.service.refreshGps(draft.eventId), {
              eventId: draft.eventId,
            });
          }}
        />
      ) : null}
    </>
  );
}
