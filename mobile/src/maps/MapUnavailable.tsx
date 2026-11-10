import { View } from "react-native";
import { useT } from "../i18n/I18nProvider.tsx";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { AppText } from "../ui/AppText.tsx";
import { Button } from "../ui/Button.tsx";
import { createMapStyles } from "./map-styles.ts";

interface Props {
  readonly isLoading: boolean;
  readonly onRetry: () => void;
}

export function MapUnavailable({ isLoading, onRetry }: Props) {
  const t = useT();
  const styles = useStyles(createMapStyles);
  if (isLoading) {
    return (
      <View style={styles.centered} accessibilityLiveRegion="polite">
        <AppText variant="button">{t("mobile.map.loading")}</AppText>
      </View>
    );
  }
  return (
    <View style={styles.centered}>
      <AppText variant="button" accessibilityRole="header">
        {t("mobile.map.unavailable")}
      </AppText>
      <AppText>{t("mobile.map.unavailableHint")}</AppText>
      <Button label={t("mobile.map.retry")} icon="refresh" onPress={onRetry} />
    </View>
  );
}
