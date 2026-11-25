import { useMemo } from "react";
import { View } from "react-native";
import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import { MapView } from "../../maps/MapView.tsx";
import type { FeatureScreenProps } from "../../navigation/screen-registry.ts";
import { useOrganizationTimeZone } from "../../sync/use-organization-time-zone.ts";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { resolveTimeZone } from "./domain.ts";
import { calendarFormat } from "./calendar-format.ts";
import { useDayLines } from "./use-day-lines.ts";

/**
 * P33b: one day's own route, full screen, one line per shift. No ScrollView around the map.
 * Reads only the phone's points of the unlocked owner (`TrackRecorder.linesForDay`).
 */
export function P33bScreen({ route }: FeatureScreenProps<"calendarTrack">) {
  const t = useT();
  const locale = useLocale();
  const timeZone = resolveTimeZone(useOrganizationTimeZone());
  const lines = useDayLines(route.date, timeZone);
  const format = useMemo(() => calendarFormat(locale, timeZone), [locale, timeZone]);
  const title = t("mobile.calendar.routeTitle", { date: format.dayDate(route.date) });
  return (
    <ScreenScaffold isScrollable={false} header={<AppHeader title={title} />}>
      {lines !== null && lines.length === 0 ? (
        <View className="px-4 pt-3">
          <InfoNotice tone="info" message={t("mobile.calendar.routePruned")} />
        </View>
      ) : null}
      <View className="flex-1">
        <MapView lines={lines ?? undefined} showDirections={false} />
      </View>
    </ScreenScaffold>
  );
}
