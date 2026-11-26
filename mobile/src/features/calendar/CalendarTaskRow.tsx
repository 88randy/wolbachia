import { ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { KIT_ICON_STROKE, kitShadow } from "../../ui/kit-styles.ts";
import { displayPointCode } from "../day/point-code.ts";
import { ACTION_KEYS } from "../day/presentation.ts";
import type { AssignedTask } from "../day/types.ts";
import { CalendarStatusPill } from "./CalendarStatusPill.tsx";
import type { CalendarItem } from "./domain.ts";

interface CalendarTaskRowProps {
  readonly item: CalendarItem & { readonly task: AssignedTask };
  /** Today's tasks open like P9; null keeps past and future rows read-only. */
  readonly onStart: (() => void) | null;
}

const FRAME = "gap-2 rounded-card border border-line bg-surface p-4";

/** Title (with a chevron when the row opens), point code and status pill. */
function rowContent(title: string, item: CalendarTaskRowProps["item"], chevron: string | null) {
  return [
    <View key="title" className="flex-row items-center gap-2">
      <AppText variant="bodyStrong" className="flex-1">
        {title}
      </AppText>
      {chevron === null ? null : (
        <ChevronRight color={chevron} size={24} strokeWidth={KIT_ICON_STROKE} />
      )}
    </View>,
    <AppText key="code" variant="code">
      {displayPointCode(item.task.point_code)}
    </AppText>,
    <CalendarStatusPill key="status" status={item.status} />,
  ];
}

/** One downloaded task of the day: action, point code and its calendar status. */
export function CalendarTaskRow({ item, onStart }: CalendarTaskRowProps) {
  const t = useT();
  const { theme } = useTheme();
  const title = t(ACTION_KEYS[item.task.action]);
  if (onStart === null)
    return (
      <View className={FRAME} style={kitShadow.card}>
        {rowContent(title, item, null)}
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onStart}
      className={`min-h-12 ${FRAME} active:opacity-80`}
      style={kitShadow.card}
    >
      {rowContent(title, item, theme.color.action)}
    </Pressable>
  );
}
