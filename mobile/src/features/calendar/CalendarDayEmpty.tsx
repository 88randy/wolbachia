import { CalendarDays } from "lucide-react-native";
import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";
import type { CalendarView } from "./service.ts";

/**
 * The selected day has no rows: skeleton while the first read runs. A later day of the open week
 * says "Sin tareas este día" (#374) once the session's tasks were read; an earlier day says
 * "Sin actividad" only when history is available (otherwise the header's notice explains it).
 */
export function CalendarDayEmpty({
  view,
  date,
  hasError,
}: {
  readonly view: CalendarView | null;
  /** The selected day; null before the first read. */
  readonly date: string | null;
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
  if (view === null) return null;
  if (date !== null && date > view.today)
    return view.identityKey === null ? null : (
      <EmptyState icon={CalendarDays} title={t("mobile.calendar.noTasks")} />
    );
  if (!view.isHistoryAvailable) return null;
  return <EmptyState icon={CalendarDays} title={t("mobile.calendar.noActivity")} />;
}
