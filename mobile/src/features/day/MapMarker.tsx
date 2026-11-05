import { ViewAnnotation } from "@maplibre/maplibre-react-native";
import { Pressable } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Badge } from "../../ui/Badge.tsx";
import type { DayTask } from "./domain.ts";
import { markerState } from "./presentation.ts";
import { createDayStyles } from "./styles.ts";
interface Props {
  readonly row: DayTask;
  readonly onSelect: () => void;
  readonly isSelected: boolean;
}
export function MapMarker({ row, onSelect, isSelected }: Props) {
  const t = useT();
  const styles = useStyles(createDayStyles);
  const state = markerState(row);
  const label = `${row.task.point_code}, ${t(state.key)}`;
  return (
    <ViewAnnotation
      id={row.task.id}
      lngLat={[row.task.lng, row.task.lat]}
      selected={isSelected}
      onPress={onSelect}
    >
      <Pressable
        style={styles.marker}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={label}
        onPress={onSelect}
      >
        <AppText variant="captionStrong">{row.task.point_code}</AppText>
        <Badge tone={state.tone} icon={state.icon} label={t(state.key)} />
      </Pressable>
    </ViewAnnotation>
  );
}
