import { Inbox } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { historyTitleKey } from "../history/domain.ts";
import { AppText } from "../../ui/AppText.tsx";
import { kitShadow } from "../../ui/kit-styles.ts";
import { SecondaryButton } from "../../ui/SecondaryButton.tsx";
import { INBOX_STATUSES } from "../../ui/status-presentation.ts";
import { CalendarStatusPill } from "./CalendarStatusPill.tsx";
import type { CalendarItem } from "./domain.ts";

interface CalendarItemRowProps {
  readonly item: CalendarItem;
  /** Time in the organization zone; null shows "Fecha no disponible". */
  readonly time: string | null;
  readonly onOpenInbox: () => void;
}

/**
 * One activity row of P33: type, time, codes when scoped (D1 rows show none), status pill.
 * Voided rows stay listed, struck through. Problems link to the inbox, where actions live.
 */
export function CalendarItemRow({ item, time, onOpenInbox }: CalendarItemRowProps) {
  const t = useT();
  const isVoided = item.status === "voided";
  return (
    <View className="gap-2 rounded-card border border-line bg-surface p-4" style={kitShadow.card}>
      <AppText variant="bodyStrong" className={isVoided ? "line-through" : undefined}>
        {t(historyTitleKey(item.kind))}
      </AppText>
      <AppText variant="caption" tone="secondary" isMonospace>
        {time ?? t("mobile.history.unknownTime")}
      </AppText>
      {item.isScoped && item.codes.length > 0 ? (
        <AppText variant="code">{item.codes.join(" · ")}</AppText>
      ) : null}
      <CalendarStatusPill status={item.status} />
      {INBOX_STATUSES.includes(item.status) ? (
        <SecondaryButton
          icon={Inbox}
          label={t("mobile.calendar.openInbox")}
          onPress={onOpenInbox}
        />
      ) : null}
    </View>
  );
}
