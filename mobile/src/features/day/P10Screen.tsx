import { useMemo } from "react";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { MapView } from "../../maps/MapView.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { toMapPoints } from "./map-points.ts";
import { RouteProblems } from "./RouteProblems.tsx";
import { useM06 } from "./use-m-06.ts";

/** Day map: every point of the route with its state; tap one, then "Cómo llegar". No scrolling here. */
export function P10Screen() {
  const model = useM06();
  const t = useT();
  const points = useMemo(() => toMapPoints(model.tasks, t), [model.tasks, t]);
  const hasMissingLocation = model.tasks.length > points.length;
  return (
    <ScreenScaffold
      tab="map"
      isScrollable={false}
      header={<AppHeader title={t("field.map.title")} onBack={null} />}
    >
      <View className="gap-3 px-4 pt-3">
        <RouteProblems model={model} />
        {hasMissingLocation ? (
          <InfoNotice tone="info" message={t("field.map.someWithoutLocation")} />
        ) : null}
      </View>
      <View className="flex-1">
        <MapView
          points={points}
          selectedId={model.selected?.task.id ?? null}
          onSelectPoint={(id) => {
            const row = model.tasks.find((candidate) => candidate.task.id === id);
            if (row !== undefined) void model.select(row.task);
          }}
        />
      </View>
    </ScreenScaffold>
  );
}
