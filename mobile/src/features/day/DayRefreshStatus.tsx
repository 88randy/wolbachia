import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Badge } from "../../ui/Badge.tsx";
import type { M06Model } from "./use-m-06.ts";

export function DayRefreshStatus({ model }: { readonly model: M06Model }) {
  const t = useT();
  if (model.state === null || (!model.isRefreshing && !model.isMapLoading)) return null;
  return (
    <View accessibilityLiveRegion="polite">
      <Badge tone="info" icon="refresh" label={t("mobile.day.updating")} />
    </View>
  );
}
