import { CircleCheck, Home, Package, Route } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { BigActionCard } from "../../ui/BigActionCard.tsx";
import { PrimaryButton } from "../../ui/PrimaryButton.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { kitShadow } from "../../ui/kit-styles.ts";
import { closeDeliveryKey } from "./domain.ts";
import type { CloseSnapshot } from "./service.ts";

/** Shift closed on the phone: summary of the day, what was left, what to return. */
export function P27Screen({ state }: { readonly state: CloseSnapshot }) {
  const t = useT();
  const { popToRoot } = useNavigation();
  const draft = state.draft;
  const returned = draft?.supplies.flatMap((supply) => supply.returns) ?? [];
  const isSent = closeDeliveryKey(state.events) === "mobile.shiftClose.serverReceived";
  return (
    <ScreenScaffold
      header={<AppHeader title={t("field.close.doneTitle")} onBack={null} />}
      footer={<PrimaryButton icon={Home} label={t("field.action.done")} onPress={popToRoot} />}
    >
      <BigActionCard
        eyebrow={t("field.close.doneEyebrow")}
        icon={CircleCheck}
        title={t("field.close.doneHeadline")}
        body={t(isSent ? "field.close.doneSent" : "field.close.doneSaved")}
      />
      {draft ? (
        <View
          className="gap-3 rounded-card border border-line bg-surface p-4"
          style={kitShadow.card}
        >
          <View className="flex-row items-center gap-2">
            <Route size={22} />
            <AppText>{t("field.close.summaryOdometer", { km: draft.odometer })}</AppText>
          </View>
          <AppText>{t("field.close.summaryLeft", { count: draft.pending.length })}</AppText>
          {returned.length > 0 ? (
            <View className="flex-row items-center gap-2">
              <Package size={22} />
              <AppText>{t("field.close.summaryReturn", { count: returned.length })}</AppText>
            </View>
          ) : null}
        </View>
      ) : null}
    </ScreenScaffold>
  );
}
