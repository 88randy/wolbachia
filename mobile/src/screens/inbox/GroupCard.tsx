import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import type { TypeGroup } from "../../outbox/outbox-event.ts";
import { formatInboxTime } from "../../sync/format-time.ts";
import { eventTypeKey, STATUS_BADGE_KEY } from "../../sync/inbox-model.ts";
import { AppText } from "../../ui/AppText.tsx";
import { StatusCard } from "../../ui/StatusCard.tsx";
import { statusTone } from "./status-tone.ts";

/** Events of one type and status: "10 · Ovitrampas revisadas", the span of their times and a status. */
export function GroupCard({ group }: { readonly group: TypeGroup }) {
  const t = useT();
  const locale = useLocale();
  const first = formatInboxTime(group.firstDeviceTime, { locale });
  const last = formatInboxTime(group.lastDeviceTime, { locale });
  return (
    <StatusCard
      title={t("mobile.inbox.groupTitle", {
        count: group.total,
        label: t(eventTypeKey(group.type)),
      })}
      statusLabel={t(STATUS_BADGE_KEY[group.status])}
      tone={statusTone(group.status)}
    >
      <AppText variant="caption" tone="secondary">
        {first === last ? first : t("mobile.inbox.timeRange", { from: first, to: last })}
      </AppText>
    </StatusCard>
  );
}
