import { View } from "react-native";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { DaySkeletonRow } from "./DaySkeletonRow.tsx";
import { createDayStyles } from "./styles.ts";

/** Static field skeletons avoid animation cost and respect reduced motion without native additions. */
export function DaySkeleton({ isMap = false }: { readonly isMap?: boolean }) {
  const styles = useStyles(createDayStyles);
  const t = useT();
  return (
    <View style={isMap ? styles.mapSkeleton : styles.group} accessibilityState={{ busy: true }}>
      <AppText accessibilityLiveRegion="polite">{t("mobile.day.loading")}</AppText>
      <View
        importantForAccessibility="no-hide-descendants"
        style={isMap ? styles.mapSkeleton : styles.group}
      >
        {isMap ? (
          <View style={styles.mapPlaceholder} />
        ) : (
          <>
            <View style={styles.skeletonLine} />
            <DaySkeletonRow />
            <DaySkeletonRow />
            <DaySkeletonRow />
          </>
        )}
      </View>
    </View>
  );
}
