import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { settingsStyles } from "./styles.ts";

export function PersonalScreensRow() {
  const t = useT();
  const { push } = useNavigation();
  return (
    <View style={settingsStyles.section}>
      <Button
        variant="outline"
        label={t("mobile.history.title")}
        onPress={() => {
          push({ name: "history" });
        }}
      />
      <Button
        variant="outline"
        label={t("trainings.mobile.title")}
        onPress={() => {
          push({ name: "training" });
        }}
      />
    </View>
  );
}
