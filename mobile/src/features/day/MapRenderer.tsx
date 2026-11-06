import { Map, Camera } from "@maplibre/maplibre-react-native";
import { useMemo } from "react";
import { useTheme, useStyles } from "../../theme/ThemeProvider.tsx";
import { useT } from "../../i18n/I18nProvider.tsx";
import { mapTasks } from "./domain.ts";
import type { DayTask } from "./domain.ts";
import type { MapFile } from "./map-coverage.ts";
import { buildPmtilesStyle } from "./pmtiles-style.ts";
import { MapMarkers } from "./MapMarkers.tsx";
import { createDayStyles } from "./styles.ts";
interface Props {
  readonly files: readonly MapFile[];
  readonly rows: readonly DayTask[];
  readonly selected: DayTask | null;
  readonly onSelect: (row: DayTask) => void;
  readonly onFailure: () => void;
}
/** Native boundary. This component always has a plain flex View parent, never a scroll container. */
export function MapRenderer({ files, rows, selected, onSelect, onFailure }: Props) {
  const { theme } = useTheme();
  const styles = useStyles(createDayStyles);
  const t = useT();
  const mapStyle = useMemo(() => buildPmtilesStyle(files, theme), [files, theme]);
  const located = mapTasks(rows);
  const target = located.find((row) => row.task.id === selected?.task.id) ?? located[0];
  return (
    <Map
      style={styles.map}
      mapStyle={mapStyle}
      accessibilityLabel={t("mobile.day.mapLabel")}
      onDidFailLoadingMap={onFailure}
      attribution={false}
    >
      {target === undefined ? null : (
        <Camera
          key={target.task.id}
          initialViewState={{ center: [target.task.lng, target.task.lat], zoom: 15 }}
        />
      )}
      <MapMarkers rows={rows} selected={selected} onSelect={onSelect} />
    </Map>
  );
}
