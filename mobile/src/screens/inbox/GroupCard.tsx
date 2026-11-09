import { spacing } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";

import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import type { TypeGroup } from "../../outbox/outbox-event.ts";
import { formatInboxTime } from "../../sync/format-time.ts";
import { eventTypeKey, STATUS_BADGE_KEY } from "../../sync/inbox-model.ts";
import { AppText } from "../../ui/AppText.tsx";
import { Badge } from "../../ui/Badge.tsx";
import { Card } from "../../ui/Card.tsx";
import { STATUS_PRESENTATION } from "../../ui/status-presentation.ts";

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing[1],
  },
  title: { flexGrow: 1, flexBasis: spacing[6] * 3 },
});

/** Events of one type and status: "10 · Ovitrampas revisadas", the span of their times and a status badge. */
export function GroupCard({ group }: { readonly group: TypeGroup }) {
  const t = useT();
  const locale = useLocale();
  const { tone, icon } = STATUS_PRESENTATION[group.status];
  const first = formatInboxTime(group.firstDeviceTime, { locale });
  const last = formatInboxTime(group.lastDeviceTime, { locale });
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.title}>
          <AppText variant="bodyStrong">
            {t("mobile.inbox.groupTitle", {
              count: group.total,
              label: t(eventTypeKey(group.type)),
            })}
          </AppText>
          <AppText variant="caption" tone="secondary" isMonospace>
            {first === last ? first : t("mobile.inbox.timeRange", { from: first, to: last })}
          </AppText>
        </View>
        <Badge tone={tone} icon={icon} label={t(STATUS_BADGE_KEY[group.status])} />
      </View>
    </Card>
  );
}
