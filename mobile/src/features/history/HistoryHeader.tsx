import { ArrowLeft, RotateCw } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { TextField } from "../../ui/TextField.tsx";
import type { useHistory } from "./use-history.ts";

export function HistoryHeader({ model }: { readonly model: ReturnType<typeof useHistory> }) {
  const t = useT();
  return (
    <View className="gap-3 pb-1">
      <TextField
        label={t("mobile.history.search")}
        placeholder={t("mobile.history.search")}
        value={model.search}
        onChangeText={model.setSearch}
        autoCapitalize="none"
      />
      {model.hasError ? <InfoNotice tone="warning" message={t("mobile.history.failed")} /> : null}
      {model.isSelected ? (
        <SecondaryButton
          icon={ArrowLeft}
          label={t("mobile.history.allShifts")}
          onPress={model.backToGroups}
        />
      ) : null}
      <SecondaryButton
        icon={RotateCw}
        label={t("mobile.history.refresh")}
        onPress={() => {
          void model.refresh();
        }}
      />
    </View>
  );
}
