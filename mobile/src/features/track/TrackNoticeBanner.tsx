import type { MessageKey } from "@wolbachia/i18n";
import { MapPinOff } from "lucide-react-native";
import { useSyncExternalStore } from "react";
import { Linking } from "react-native";
import { useServices } from "../../app/services-context.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import type { TrackNotice } from "./track-recorder.ts";

const KEYS: Readonly<Record<Exclude<TrackNotice, null>, MessageKey>> = {
  locationDenied: "mobile.track.locationDenied",
  notificationsDenied: "mobile.track.notificationsDenied",
  unavailable: "mobile.track.unavailable",
};

/** Calm note when the track is not (fully) recorded; it never blocks work. */
export function TrackNoticeBanner() {
  const t = useT();
  const { track } = useServices();
  const { notice } = useSyncExternalStore(track.subscribe, track.getSnapshot);
  if (notice === null) return null;
  const openSettings = {
    label: t("mobile.track.openSettings"),
    onPress: () => void Linking.openSettings(),
  };
  return (
    <InfoNotice
      tone="info"
      icon={MapPinOff}
      message={t(KEYS[notice])}
      {...(notice === "unavailable" ? {} : { action: openSettings })}
    />
  );
}
