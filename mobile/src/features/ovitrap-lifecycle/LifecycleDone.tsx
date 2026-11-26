import { CircleCheck, Home } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { BigActionCard } from "../../ui/BigActionCard.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { LifecycleCorrection } from "./LifecycleCorrection.tsx";
import { deliveryState } from "./domain.ts";
import type { LifecycleProps } from "./model.ts";

/** Saved on the phone. Says what happens next in plain words and leaves one button: back to the day. */
export function LifecycleDone(props: LifecycleProps) {
  const { model, draft } = props;
  const t = useT();
  const { popToRoot } = useNavigation();
  const event = model.state?.event ?? null;
  const delivery = deliveryState(event);
  const proposal = model.state?.proposal;
  return (
    <ScreenScaffold
      header={<AppHeader title={t(`field.lifecycle.kind.${draft.kind}`)} onBack={null} />}
      footer={<PrimaryButton icon={Home} label={t("field.action.done")} onPress={popToRoot} />}
    >
      <BigActionCard
        eyebrow={t("field.lifecycle.doneEyebrow")}
        icon={CircleCheck}
        title={t("field.lifecycle.doneTitle")}
        body={t(
          delivery.server === "received" ? "field.lifecycle.doneSent" : "field.lifecycle.doneSaved",
        )}
      />
      {delivery.review === "in_review" ? (
        <InfoNotice tone="info" message={t("field.lifecycle.doneReview")} />
      ) : null}
      {delivery.review === "rejected" ? (
        <InfoNotice tone="danger" message={t("field.lifecycle.doneRejected")} />
      ) : null}
      {proposal ? (
        <InfoNotice tone="info" message={t(`field.lifecycle.proposal.${proposal.status}`)} />
      ) : null}
      <LifecycleCorrection {...props} />
    </ScreenScaffold>
  );
}
