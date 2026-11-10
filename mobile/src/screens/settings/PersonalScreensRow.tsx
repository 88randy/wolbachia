import { GraduationCap, History } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { ActionTile } from "../../ui/ActionTile.tsx";

export function PersonalScreensRow() {
  const t = useT();
  const { push } = useNavigation();
  return (
    <View className="flex-row gap-3">
      <ActionTile
        icon={History}
        label={t("mobile.history.title")}
        onPress={() => {
          push({ name: "history" });
        }}
      />
      <ActionTile
        icon={GraduationCap}
        label={t("trainings.mobile.title")}
        onPress={() => {
          push({ name: "training" });
        }}
      />
    </View>
  );
}
