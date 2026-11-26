import { useTranslation } from "react-i18next";
import { StatusPill } from "../../ui/StatusPill";
import type { Tone } from "../../ui/tone";

const TONES: Readonly<Record<string, Tone>> = {
  active: "success",
  scheduled: "info",
  expired: "neutral",
  revoked: "critical",
};

/** Status of a key: color, icon and text together. */
export function ApiKeyStatus({ status }: { status: string }) {
  const { t } = useTranslation();
  const known = status in TONES;
  return (
    <StatusPill tone={TONES[status] ?? "neutral"}>
      {known ? t(`apiKeys.status.${status as "active"}`) : status}
    </StatusPill>
  );
}
