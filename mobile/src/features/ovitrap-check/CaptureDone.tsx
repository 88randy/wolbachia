import { CircleCheck, Home, MapPinPlus, ScanLine } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import type { OutboxEvent } from "../../outbox/outbox-event.ts";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { BigActionCard } from "../../ui/BigActionCard.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { PointLifecycleEntry } from "../ovitrap-lifecycle/PointLifecycleEntry.tsx";
import type { M08Model } from "./use-m-08.ts";

function bodyKey(status: OutboxEvent["status"]) {
  if (status === "sent") return "field.capture.doneSent";
  if (status === "in_review") return "field.capture.doneReview";
  if (status === "rejected") return "field.capture.doneRejected";
  return "field.capture.doneSaved";
}

/** Saved on the phone. Next ovitrap is the main button; the other actions of this trap sit below. */
export function CaptureDone({
  model,
  event,
}: {
  readonly model: M08Model;
  readonly event: OutboxEvent;
}) {
  const t = useT();
  const { push, replace } = useNavigation();
  return (
    <ScreenScaffold
      header={<AppHeader title={t("field.capture.title")} onBack={null} />}
      footer={
        <>
          <PrimaryButton
            icon={ScanLine}
            label={t("field.capture.nextOne")}
            onPress={() => {
              push({ name: "ovitrapScanner", target: "ovitrap", eventId: event.envelope.id });
            }}
          />
          <SecondaryButton
            icon={Home}
            label={t("field.capture.backToRoute")}
            onPress={() => {
              replace({ name: "day" });
            }}
          />
        </>
      }
    >
      <BigActionCard
        eyebrow={t("field.capture.doneEyebrow")}
        icon={CircleCheck}
        title={t("field.capture.doneTitle")}
        body={t(bodyKey(event.status))}
      />
      {event.status === "rejected" ? (
        <InfoNotice tone="danger" message={t("field.capture.doneRejectedHint")} />
      ) : null}
      <View className="gap-3">
        <SecondaryButton
          icon={MapPinPlus}
          label={t("field.capture.placeAnother")}
          disabled={model.isBusy || model.state?.canStartCapture !== true}
          onPress={() => {
            void model.run(() => model.service.startPlace(null), {
              eventId: null,
              startsCapture: true,
            });
          }}
        />
        <PointLifecycleEntry model={model} />
      </View>
    </ScreenScaffold>
  );
}
