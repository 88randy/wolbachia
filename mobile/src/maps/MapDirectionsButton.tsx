import { useT } from "../i18n/I18nProvider.tsx";
import { androidNavigation } from "../navigation/android-navigation.ts";
import { geoUri } from "../navigation/navigation-service.ts";
import { Button } from "../ui/Button.tsx";
import type { MapPoint } from "./map-types.ts";

/** "Como llegar": hands the destination to the external maps app. Only coordinates and the label leave. */
export function MapDirectionsButton({ point }: { readonly point: MapPoint }) {
  const t = useT();
  const uri = geoUri({ id: point.id, point_code: point.label, lat: point.lat, lng: point.lng });
  return (
    <Button
      label={t("mobile.day.navigate")}
      variant="outline"
      icon="navigation"
      disabled={uri === null}
      onPress={() => {
        if (uri !== null) void androidNavigation.launch(uri);
      }}
    />
  );
}
