import type { MessageKey } from "@wolbachia/i18n";
import { MapPinOff } from "lucide-react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";
import type { TrackNotice } from "./track-recorder.ts";

const KEYS: Readonly<Record<Exclude<TrackNotice, null>, MessageKey>> = {
  locationDenied: "mobile.track.locationDenied",
  notificationsDenied: "mobile.track.notificationsDenied",
  unavailable: "mobile.track.unavailable",
};

/** Calm note when the track is not (fully) recorded; it never blocks work. */
export function TrackNoticeBanner({ notice }: { readonly notice: TrackNotice }) {
  const t = useT();
  return notice === null ? null : (
    <InfoNotice tone="info" icon={MapPinOff} message={t(KEYS[notice])} />
  );
}
