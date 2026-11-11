import { ViewAnnotation } from "@maplibre/maplibre-react-native";
import { Pressable } from "react-native";
import { useStyles } from "../theme/ThemeProvider.tsx";
import { AppText } from "../ui/AppText.tsx";
import { createMapStyles } from "./map-styles.ts";
import type { MapPoint } from "./map-types.ts";

interface Props {
  readonly point: MapPoint;
  readonly isSelected: boolean;
  readonly onSelect: (id: string) => void;
}

/** Only the point code on the map; its status (icon + text) is shown in the card under the map. */
export function MapPointMarker({ point, isSelected, onSelect }: Props) {
  const styles = useStyles(createMapStyles);
  const select = () => {
    onSelect(point.id);
  };
  return (
    <ViewAnnotation
      id={point.id}
      lngLat={[point.lng, point.lat]}
      selected={isSelected}
      onPress={select}
    >
      <Pressable
        style={[styles.marker, isSelected && styles.markerSelected]}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={`${point.label}, ${point.statusLabel}`}
        onPress={select}
      >
        <AppText variant="captionStrong">{point.label}</AppText>
      </Pressable>
    </ViewAnnotation>
  );
}
