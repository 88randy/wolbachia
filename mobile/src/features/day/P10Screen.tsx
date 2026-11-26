import { useMemo } from "react";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useFieldZones } from "../../maps/use-field-zones.ts";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { TrackNoticeBanner } from "../track/TrackNoticeBanner.tsx";
import { toMapPoints, zonesOfTasks } from "./map-points.ts";
import { P10Map } from "./P10Map.tsx";
import { RouteProblems } from "./RouteProblems.tsx";
import { useM06 } from "./use-m-06.ts";

/** Day map: every point of the route with its state; tap one, then "Cómo llegar". No scrolling here. */
export function P10Screen() {
  const model = useM06();
  const t = useT();
  const points = useMemo(() => toMapPoints(model.tasks, t), [model.tasks, t]);
  const allZones = useFieldZones();
  const zones = useMemo(() => zonesOfTasks(allZones, model.tasks), [allZones, model.tasks]);
  const hasMissingLocation = model.tasks.length > points.length;
  return (
    <ScreenScaffold
      tab="map"
      isScrollable={false}
      header={<AppHeader title={t("field.map.title")} onBack={null} />}
    >
      <View className="gap-3 px-4 pt-3">
        <RouteProblems model={model} />
        <TrackNoticeBanner />
        {hasMissingLocation ? (
          <InfoNotice tone="info" message={t("field.map.someWithoutLocation")} />
        ) : null}
      </View>
      <P10Map model={model} points={points} zones={zones} />
    </ScreenScaffold>
  );
}
