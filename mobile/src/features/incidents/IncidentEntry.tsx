import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { Button } from "../../ui/Button.tsx";

export function IncidentEntry() {
  const t = useT(),
    { push } = useNavigation();
  return (
    <View>
      <Button
        label={t("mobile.incidents.title")}
        variant="outline"
        onPress={() => {
          push({ name: "incidents" });
        }}
      />
      <Button
        label={t("mobile.incidents.emergency")}
        onPress={() => {
          push({ name: "emergency" });
        }}
      />
    </View>
  );
}
