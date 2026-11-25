import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import type { ProblemItem } from "../../outbox/outbox-event.ts";
import { formatInboxTime } from "../../sync/format-time.ts";
import { useOrganizationTimeZone } from "../../sync/use-organization-time-zone.ts";
import { eventTypeKey, problemMessageKey } from "../../sync/inbox-model.ts";
import { AppText } from "../../ui/AppText.tsx";
import { StatusCard } from "../../ui/StatusCard.tsx";
import { statusCardOf } from "./status-tone.ts";

/** One event the server refused or put in review, or that could not be sent: what happened, in plain words. */
export function ProblemCard({ item }: { readonly item: ProblemItem }) {
  const t = useT();
  const locale = useLocale();
  const timeZone = useOrganizationTimeZone();
  const status = statusCardOf(item.status);
  return (
    <StatusCard
      title={t(eventTypeKey(item.type))}
      statusLabel={t(status.label)}
      tone={status.tone}
      icon={status.icon}
    >
      <AppText variant="caption" tone="secondary">
        {formatInboxTime(item.deviceTime, { locale, timeZone })}
      </AppText>
      <AppText variant="body">{t(problemMessageKey(item))}</AppText>
    </StatusCard>
  );
}
