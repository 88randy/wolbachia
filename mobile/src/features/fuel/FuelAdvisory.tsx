import type { MessageKey } from "@wolbachia/i18n";
import { View } from "react-native";
import { useT, useLocale } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Notice } from "../../ui/Notice.tsx";
import type { FuelAdvisory as Advisory } from "./types.ts";

const ADVISORY_KEYS: Readonly<Record<Advisory["kind"], MessageKey>> = {
  insufficient: "mobile.fuel.insufficient",
  unconfigured: "mobile.fuel.unconfigured",
  decreased: "mobile.fuel.decreased",
  ok: "mobile.fuel.efficiencyOk",
  review: "mobile.fuel.efficiencyReview",
};
export function FuelAdvisory({ advisory }: { readonly advisory: Advisory }) {
  const t = useT();
  const locale = useLocale();
  const isWarning = advisory.kind === "decreased" || advisory.kind === "review";
  return (
    <View>
      <Notice
        tone={isWarning ? "warning" : "info"}
        icon={isWarning ? "alert" : "list"}
        message={t(ADVISORY_KEYS[advisory.kind])}
      />
      {advisory.efficiencyKmL === null ? null : (
        <AppText isMonospace>
          {t("fleet.efficiency.value", {
            value: advisory.efficiencyKmL.toLocaleString(locale, { maximumFractionDigits: 2 }),
          })}
        </AppText>
      )}
      {advisory.minimum === null || advisory.maximum === null ? null : (
        <AppText>
          {t("fleet.efficiency.thresholds", {
            min: advisory.minimum.toLocaleString(locale),
            max: advisory.maximum.toLocaleString(locale),
          })}
        </AppText>
      )}
    </View>
  );
}
