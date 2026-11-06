import type { MessageKey } from "@wolbachia/i18n";
import { useTranslation } from "react-i18next";
import { StatusPill } from "../ui/StatusPill";
import type { Tone } from "../ui/tone";
import type { RuleParameterVersion } from "./rules-query";
type Status = RuleParameterVersion["status"];
const STATUS: Record<Status, { tone: Tone; label: MessageKey }> = {
  scheduled: { tone: "info", label: "rules.status.scheduled" },
  in_force: { tone: "success", label: "rules.status.inForce" },
  superseded: { tone: "neutral", label: "rules.status.superseded" },
  voided: { tone: "critical", label: "rules.status.voided" },
};
/** API status text remains explicit; the shared pill adds the matching non-color cue. */
export function VersionStatusBadge({ status }: { status: Status }) {
  const { t } = useTranslation();
  const { tone, label } = STATUS[status];
  return <StatusPill tone={tone}>{t(label)}</StatusPill>;
}
