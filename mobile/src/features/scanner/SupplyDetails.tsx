import { Package } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { kitShadow } from "../../ui/kit-styles.ts";
import type { ScannerResource } from "./resource-source.ts";

/** What the scanned supply is: how many, and for which day. No codes or internal numbers. */
export function SupplyDetails({ resource }: { readonly resource: ScannerResource }) {
  const t = useT();
  const supply = resource.supply;
  if (!supply) return <InfoNotice tone="warning" message={t("field.scan.unavailable")} />;
  return (
    <View className="gap-3 rounded-card border border-line bg-surface p-4" style={kitShadow.card}>
      <View className="flex-row items-center gap-2">
        <Package size={24} />
        <AppText variant="h2" accessibilityRole="header">
          {t("field.scan.supplyTitle")}
        </AppText>
      </View>
      <AppText variant="bodyStrong">
        {t("field.scan.supplyQuantity", { quantity: supply.expected })}
      </AppText>
      <AppText tone="secondary">{t("field.scan.supplyDate", { date: supply.date })}</AppText>
    </View>
  );
}
