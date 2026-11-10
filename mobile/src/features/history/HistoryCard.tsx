import type { MessageKey } from "@wolbachia/i18n";
import { useT } from "../../i18n/I18nProvider.tsx";
import { eventTypeKey, STATUS_BADGE_KEY } from "../../sync/inbox-model.ts";
import { AppText } from "../../ui/AppText.tsx";
import { Badge } from "../../ui/Badge.tsx";
import type { BadgeTone } from "../../ui/Badge.tsx";
import { Card } from "../../ui/Card.tsx";
import { STATUS_PRESENTATION } from "../../ui/status-presentation.ts";
import type { HistoryEntry } from "./domain.ts";
import { HistoryProvenance } from "./HistoryProvenance.tsx";

function presentation(entry: HistoryEntry): { tone: BadgeTone; label: MessageKey } {
  if (entry.status === "reviewed") return { tone: "success", label: "mobile.history.reviewed" };
  if (entry.status === "voided") return { tone: "critical", label: "mobile.history.voided" };
  if (entry.status === "observed") return { tone: "warning", label: "mobile.history.observed" };
  if (entry.status === "sent") return { tone: "success", label: "mobile.history.received" };
  return { tone: STATUS_PRESENTATION[entry.status].tone, label: STATUS_BADGE_KEY[entry.status] };
}
export function HistoryCard({
  entry,
  formattedTime,
}: {
  readonly entry: HistoryEntry;
  readonly formattedTime: string | null;
}) {
  const t = useT(),
    state = presentation(entry);
  return (
    <Card>
      <AppText variant="button">
        {t(entry.isServerDecision ? "mobile.history.serverFact" : eventTypeKey(entry.kind))}
      </AppText>
      <Badge icon="search" tone={state.tone} label={t(state.label)} />
      <AppText isMonospace>{formattedTime ?? t("mobile.history.unknownTime")}</AppText>
      {entry.codes.map((code) => (
        <AppText key={code} isMonospace>
          {code}
        </AppText>
      ))}
      <HistoryProvenance entry={entry} />
    </Card>
  );
}
