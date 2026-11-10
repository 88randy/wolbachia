import { StyleSheet, View } from "react-native";
import { radius, spacing } from "@wolbachia/tokens";
import type { Theme } from "@wolbachia/tokens";

import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { causeKey } from "./copy.ts";
import type { SafetyRules, SafetyState } from "./domain.ts";

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    panel: { backgroundColor: theme.color.surface, borderRadius: radius.lg, padding: spacing[2] },
  });

/** The current speed against the configured limit; an unknown speed is stated, never guessed. */
export function SpeedPanel({
  safety,
  rules,
}: {
  readonly safety: SafetyState;
  readonly rules: SafetyRules;
}) {
  const styles = useStyles(createStyles);
  const t = useT();
  return (
    <View style={styles.panel}>
      {safety.speedKmh === null ? (
        <Notice tone="warning" icon="location" message={t(causeKey("gpsUnreliable"))} />
      ) : (
        <AppText isMonospace>
          {t("mobile.speedLock.speed", { speed: Math.round(safety.speedKmh) })}
        </AppText>
      )}
      <AppText variant="caption" tone="secondary">
        {t("mobile.speedLock.limit", { limit: rules.lockKmh })}
      </AppText>
    </View>
  );
}
