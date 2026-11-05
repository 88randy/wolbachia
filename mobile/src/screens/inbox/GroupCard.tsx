import { spacing } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";

import { useT } from "../../i18n/I18nProvider.tsx";
import type { TypeGroup } from "../../outbox/outbox-event.ts";
import { formatClock } from "../../sync/format-time.ts";
import { eventTypeKey, STATUS_BADGE_KEY } from "../../sync/inbox-model.ts";
import { AppText } from "../../ui/AppText.tsx";
import { Badge } from "../../ui/Badge.tsx";
import { Card } from "../../ui/Card.tsx";
import { STATUS_PRESENTATION } from "../../ui/status-presentation.ts";

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing[1],
  },
  title: { flex: 1 },
});

/** Events of one type and status: "10 · Ovitrampas revisadas", the span of their times and a status badge. */
export function GroupCard({ group }: { readonly group: TypeGroup }) {
  const t = useT();
  const { tone, icon } = STATUS_PRESENTATION[group.status];
  const first = formatClock(group.firstDeviceTime);
  const last = formatClock(group.lastDeviceTime);
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
          <AppText variant="caption" tone="secondary">
            {first === last ? first : t("mobile.inbox.timeRange", { from: first, to: last })}
          </AppText>
        </View>
        <Badge tone={tone} icon={icon} label={t(STATUS_BADGE_KEY[group.status])} />
      </View>
    </Card>
  );
}
