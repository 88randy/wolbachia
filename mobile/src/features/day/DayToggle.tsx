import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { createDayStyles } from "./styles.ts";
export function DayToggle({ isMap }: { readonly isMap: boolean }) {
  const t = useT();
  const { push, goBack } = useNavigation();
  const styles = useStyles(createDayStyles);
  return (
    <View style={styles.toggle}>
      <Button
        label={t("mobile.day.list")}
        icon="list"
        variant={isMap ? "outline" : "primary"}
        onPress={() => {
          if (isMap) goBack();
        }}
      />
      <Button
        label={t("mobile.day.map")}
        icon="map"
        variant={isMap ? "primary" : "outline"}
        onPress={() => {
          if (!isMap) push({ name: "map" });
        }}
      />
    </View>
  );
}
