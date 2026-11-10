import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { createFuelStyles } from "./styles.ts";

export function FuelMotorcycle({ code }: { readonly code: string }) {
  const t = useT();
  const styles = useStyles(createFuelStyles);
  return (
    <View style={styles.group}>
      <AppText variant="bodyStrong">{t("mobile.fuel.motorcycle")}</AppText>
      <AppText variant="code" selectable>
        {code}
      </AppText>
      <AppText variant="caption">{t("mobile.fuel.motorcycleFixed")}</AppText>
    </View>
  );
}
