import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { createSkeletonStyles } from "../day/skeleton-styles.ts";
export function CloseSkeleton() {
  const t = useT();
  const styles = useStyles(createSkeletonStyles);
  return (
    <View accessible accessibilityLabel={t("mobile.day.loading")} style={styles.mapSkeleton}>
      <View style={styles.skeletonLine} />
      <View style={styles.skeletonLine} />
    </View>
  );
}
