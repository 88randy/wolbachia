import { useT } from "../../i18n/I18nProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { Notice } from "../../ui/Notice.tsx";
import { isMapReady } from "./domain.ts";
import type { MapPreparation } from "./domain.ts";
function messageKey(map: MapPreparation | null) {
  if (isMapReady(map)) return "mobile.shiftOpen.mapReady";
  if (map?.status === "preparing") return "mobile.shiftOpen.mapPreparing";
  if (map?.status === "failed") return "mobile.shiftOpen.mapFailed";
  return map?.status === "ready"
    ? "mobile.shiftOpen.mapIncomplete"
    : "mobile.shiftOpen.mapUnavailable";
}
export function MapStatus({ map }: { readonly map: MapPreparation | null }) {
  const t = useT();
  return (
    <>
      <Notice
        tone={isMapReady(map) ? "info" : "warning"}
        icon="alert"
        message={t(messageKey(map))}
      />
      <AppText accessibilityLiveRegion="polite">{t("mobile.shiftOpen.mapProgress")}</AppText>
      <AppText
        accessibilityRole="progressbar"
        accessibilityLabel={t("mobile.shiftOpen.mapProgress")}
        accessibilityState={{ busy: map?.status === "preparing" }}
        accessibilityValue={{ min: 0, max: 100, now: map?.progress ?? 0 }}
      >
        {map?.progress ?? 0}
      </AppText>
    </>
  );
}
