import { CircleCheck, PencilLine, Route } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { BigActionCard } from "../../ui/BigActionCard.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { DepartureSummary } from "./DepartureSummary.tsx";
import { SaveFeedback } from "./SaveFeedback.tsx";
import type { ShiftSnapshot } from "./service.ts";
import type { M04Model } from "./use-m-04.ts";

function deliveryKey(status: string) {
  if (status === "sent") return "field.open.deliverySent";
  if (status === "in_review") return "field.open.deliveryReview";
  return "field.open.deliverySaved";
}

/** After "Salir": the shift is open on the phone. One button leads to the route. */
export function OpenedShift({
  model,
  state,
}: {
  readonly model: M04Model;
  readonly state: ShiftSnapshot;
}) {
  const t = useT();
  const { replace } = useNavigation();
  const opening = state.opening;
  if (!opening) return null;
  const isRejected = opening.status === "rejected";
  return (
    <ScreenScaffold
      header={<AppHeader title={t("field.open.title")} />}
      footer={
        isRejected ? (
          <PrimaryButton
            icon={PencilLine}
            label={t("field.open.fix")}
            disabled={model.isBusy}
            onPress={() => {
              void model.run(() => model.service.restartRejected());
            }}
          />
        ) : (
          <PrimaryButton
            icon={Route}
            label={t("field.open.seeRoute")}
            onPress={() => {
              replace({ name: "day" });
            }}
          />
        )
      }
    >
      <SaveFeedback model={model} />
      <BigActionCard
        eyebrow={t("field.open.openedEyebrow")}
        icon={CircleCheck}
        title={t(isRejected ? "field.open.rejectedTitle" : "field.open.openedTitle")}
        body={t(isRejected ? "field.open.rejectedBody" : "field.open.openedBody")}
      />
      <InfoNotice tone={isRejected ? "danger" : "info"} message={t(deliveryKey(opening.status))} />
      <DepartureSummary state={state} />
    </ScreenScaffold>
  );
}
