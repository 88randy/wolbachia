import { Check, RotateCw } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import { CommunityDone } from "./CommunityDone.tsx";
import { CommunityForm } from "./CommunityForm.tsx";
import { useCommunity } from "./use-community.ts";

/** P25: promoters and couriers register a community activity: type, block, people, agreements. */
export function CommunityScreen() {
  const t = useT();
  const model = useCommunity();
  if (model.send === "sent") return <CommunityDone onAnother={model.startAnother} />;
  return (
    <ScreenScaffold
      header={
        <AppHeader
          title={t("courier.flow.community.title")}
          subtitle={t("courier.flow.community.subtitle")}
        />
      }
      footer={
        <PrimaryButton
          icon={Check}
          label={t("courier.flow.community.send")}
          isLoading={model.send === "sending"}
          disabled={!model.canSend}
          onPress={() => {
            void model.submit();
          }}
        />
      }
    >
      {model.load === "failed" ? (
        <>
          <InfoNotice tone="warning" message={t("courier.flow.community.needsSignal")} />
          <SecondaryButton
            icon={RotateCw}
            label={t("common.actions.retry")}
            onPress={() => {
              void model.reload();
            }}
          />
        </>
      ) : null}
      {model.load === "loading" ? (
        <>
          <Skeleton />
          <Skeleton />
          <Skeleton isShort />
        </>
      ) : null}
      {model.load === "ready" ? <CommunityForm model={model} /> : null}
      {model.send === "failed" ? (
        <InfoNotice tone="danger" message={t("courier.flow.community.sendFailed")} />
      ) : null}
    </ScreenScaffold>
  );
}
