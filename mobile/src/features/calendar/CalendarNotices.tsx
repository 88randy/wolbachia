import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { InfoNotice } from "../../ui/InfoNotice.tsx";

interface CalendarNoticesProps {
  readonly hasError: boolean;
  /** History gates closed (locked, other session, no scope): never shown as "no activity". */
  readonly isUnavailable: boolean;
  readonly onRetry: () => void;
  readonly onOpenInbox: () => void;
}

/** Read failure (with Retry; the grid keeps its last data) and P29's unavailable notice. */
export function CalendarNotices({
  hasError,
  isUnavailable,
  onRetry,
  onOpenInbox,
}: CalendarNoticesProps) {
  const t = useT();
  return (
    <View className="gap-3 px-3">
      {hasError ? (
        <InfoNotice
          tone="warning"
          message={t("mobile.calendar.readFailed")}
          action={{ label: t("mobile.calendar.retry"), onPress: onRetry }}
        />
      ) : null}
      {isUnavailable ? (
        <InfoNotice
          tone="info"
          message={t("mobile.history.unavailable")}
          action={{ label: t("mobile.calendar.openInbox"), onPress: onOpenInbox }}
        />
      ) : null}
    </View>
  );
}
