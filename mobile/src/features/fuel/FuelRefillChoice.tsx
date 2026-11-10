import { Fuel, X } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ChoiceButton } from "../../ui/ChoiceButton.tsx";
import type { M11Model } from "./use-m-11.ts";

/** "Full tank?": two big answers, the chosen one filled. */
export function FuelRefillChoice({ model }: { readonly model: M11Model }) {
  const t = useT();
  const draft = model.state?.draft;
  if (!draft) return null;
  const disabled = model.isBusy || !model.state?.ready || model.state.event !== null;
  return (
    <View className="gap-2">
      <AppText variant="bodyStrong">{t("mobile.fuel.fullRefill")}</AppText>
      <View className="flex-row gap-3">
        <ChoiceButton
          label={t("courier.choice.yes")}
          icon={Fuel}
          tone="yes"
          isSelected={draft.isFullRefill}
          disabled={disabled}
          onPress={() => {
            model.edit("isFullRefill", true);
          }}
        />
        <ChoiceButton
          label={t("courier.choice.no")}
          icon={X}
          tone="no"
          isSelected={!draft.isFullRefill}
          disabled={disabled}
          onPress={() => {
            model.edit("isFullRefill", false);
          }}
        />
      </View>
    </View>
  );
}
