import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useNavigation } from "../../navigation/NavigationProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Button } from "../../ui/Button.tsx";
import type { M06Model } from "./use-m-06.ts";
import { createDayStyles } from "./styles.ts";
export function MissingMap({ model }: { readonly model: M06Model }) {
  const t = useT();
  const { goBack } = useNavigation();
  const styles = useStyles(createDayStyles);
  return (
    <View style={styles.content}>
      <AppText variant="button" accessibilityRole="header">
        {t("mobile.day.noMap")}
      </AppText>
      <AppText>{t("mobile.day.noMapHint")}</AppText>
      <Button
        label={t("mobile.day.retryMap")}
        icon="refresh"
        onPress={() => {
          void model.retryMap();
        }}
      />
      <Button label={t("mobile.day.backList")} icon="list" onPress={goBack} />
    </View>
  );
}
