import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";

export function FuelEntry({ isAllowed }: { readonly isAllowed: boolean }) {
  const t = useT();
  const { push } = useNavigation();
  return (
    <View>
      <Button
        label={t("mobile.fuel.title")}
        disabled={!isAllowed}
        onPress={() => {
          push({ name: "fuel" });
        }}
      />
      {isAllowed ? null : <AppText variant="caption">{t("mobile.fuel.shiftRequired")}</AppText>}
    </View>
  );
}
