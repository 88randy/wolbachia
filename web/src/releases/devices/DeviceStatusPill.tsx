import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { StatusPill } from "../../ui/StatusPill";
import type { Tone } from "../../ui/tone";

const STATUS: Record<string, { tone: Tone; key: MessageKey }> = {
  active: { tone: "success", key: "releases.devices.status.active" },
  inactive: { tone: "warning", key: "releases.devices.status.inactive" },
  retired: { tone: "neutral", key: "releases.devices.status.retired" },
};

/** Active, inactive or retired: color + icon + text. An unknown status reads as neutral. */
export function DeviceStatusPill({ status }: { status: string }) {
  const { t } = useTranslation();
  const known = STATUS[status] ?? STATUS["retired"];
  if (known === undefined) return null;
  return <StatusPill tone={known.tone}>{t(known.key)}</StatusPill>;
}
