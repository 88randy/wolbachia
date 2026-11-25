import { CalendarDays } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import type { CalendarView } from "./service.ts";

/**
 * The selected day has no rows: skeleton while the first read runs; "Sin actividad" only when
 * history is available (otherwise the header's unavailable notice explains it).
 */
export function CalendarDayEmpty({
  view,
  hasError,
}: {
  readonly view: CalendarView | null;
  readonly hasError: boolean;
}) {
  const t = useT();
  if (view === null && !hasError)
    return (
      <View className="gap-3 px-3">
        <Skeleton />
        <Skeleton isShort />
      </View>
    );
  if (view === null || !view.isHistoryAvailable) return null;
  return <EmptyState icon={CalendarDays} title={t("mobile.calendar.noActivity")} />;
}
