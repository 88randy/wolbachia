import { MapPin, MapPinOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFormatDateTime } from "../../format/use-format-date-time";
import type { LivePosition } from "./use-live-tracking";

/** The list equivalent of a courier's dot: its age in words, the exact phone time on hover. */
export function PositionAge({ position }: { position: LivePosition | undefined }) {
  const { t } = useTranslation();
  const format = useFormatDateTime();
  if (!position)
    return (
      <p className="m-0 flex items-center gap-2 text-[13px] text-ink-2">
        <MapPinOff aria-hidden="true" className="size-3.5" />
        {t("live.position.none")}
      </p>
    );
  const Icon = position.isStale ? MapPinOff : MapPin;
  return (
    <p className="m-0 flex items-center gap-2 text-[13px] text-ink-2">
      <Icon aria-hidden="true" className="size-3.5" />
      <time dateTime={position.recorded_at} title={format(position.recorded_at)}>
        {t(position.isStale ? "live.position.stale" : "live.position.recent", {
          minutes: position.minutes,
        })}
      </time>
    </p>
  );
}
