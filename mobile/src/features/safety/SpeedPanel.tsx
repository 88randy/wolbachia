import { View } from "react-native";

import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { causeKey } from "./copy.ts";
import type { SafetyRules, SafetyState } from "./domain.ts";

/** The current speed against the configured limit; an unknown speed is stated, never guessed. */
export function SpeedPanel({
  safety,
  rules,
}: {
  readonly safety: SafetyState;
  readonly rules: SafetyRules;
}) {
  const t = useT();
  return (
    <View className="gap-1 rounded-card bg-surface p-4">
      {safety.speedKmh === null ? (
        <InfoNotice tone="warning" message={t(causeKey("gpsUnreliable"))} />
      ) : (
        <AppText variant="number" className="text-center">
          {t("mobile.speedLock.speed", { speed: Math.round(safety.speedKmh) })}
        </AppText>
      )}
      <AppText variant="caption" tone="secondary" className="text-center">
        {t("mobile.speedLock.limit", { limit: rules.lockKmh })}
      </AppText>
    </View>
  );
}
