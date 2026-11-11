import { useTranslation } from "react-i18next";
import { StatusPill } from "../../ui/StatusPill";
import type { Tone } from "../../ui/tone";
import type { DeliveryStatus } from "./use-assignment-panel";

const TONES: Record<DeliveryStatus, Tone> = {
  planned: "neutral",
  released: "info",
  received: "success",
  cancelled: "warning",
};

/** Color, icon and text together: where this delivery stands. */
export function DeliveryStatusPill({ status }: { status: DeliveryStatus }) {
  const { t } = useTranslation();
  return <StatusPill tone={TONES[status]}>{t(`allocation.delivery.status.${status}`)}</StatusPill>;
}
