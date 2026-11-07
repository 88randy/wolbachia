import { spacing } from "@wolbachia/tokens";
import { StyleSheet, View } from "react-native";

import { useLocale, useT } from "../../i18n/I18nProvider.tsx";
import type { ProblemItem } from "../../outbox/outbox-event.ts";
import { formatInboxTime } from "../../sync/format-time.ts";
import { eventTypeKey, problemMessageKey, STATUS_BADGE_KEY } from "../../sync/inbox-model.ts";
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

/** One event the server refused or put in review, or that could not be sent: what happened, in plain words. */
export function ProblemCard({ item }: { readonly item: ProblemItem }) {
  const t = useT();
  const locale = useLocale();
  const { tone, icon } = STATUS_PRESENTATION[item.status];
  return (
    <Card isCritical={item.status === "rejected" || item.status === "error"}>
      <View style={styles.row}>
        <View style={styles.title}>
          <AppText variant="bodyStrong">{t(eventTypeKey(item.type))}</AppText>
          <AppText variant="caption" tone="secondary" isMonospace>
            {formatInboxTime(item.deviceTime, { locale })}
          </AppText>
        </View>
        <Badge tone={tone} icon={icon} label={t(STATUS_BADGE_KEY[item.status])} />
      </View>
      <AppText>{t(problemMessageKey(item))}</AppText>
    </Card>
  );
}
