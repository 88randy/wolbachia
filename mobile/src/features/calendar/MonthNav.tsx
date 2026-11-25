import { ChevronLeft, ChevronRight } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { KIT_ICON_STROKE } from "../../ui/kit-styles.ts";

interface MonthNavProps {
  readonly title: string;
  /** null at the first/last month that holds kept days or downloaded tasks. */
  readonly onPrevious: (() => void) | null;
  readonly onNext: (() => void) | null;
}

function Arrow(props: { icon: LucideIcon; label: string; onPress: (() => void) | null }) {
  const { theme } = useTheme();
  const Icon = props.icon;
  const isEnabled = props.onPress !== null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: !isEnabled }}
      disabled={!isEnabled}
      onPress={props.onPress ?? undefined}
      className="min-h-12 min-w-12 items-center justify-center rounded-xl active:opacity-70"
    >
      <Icon
        color={isEnabled ? theme.color.action : theme.color.text.tertiary}
        size={24}
        strokeWidth={KIT_ICON_STROKE}
      />
    </Pressable>
  );
}

/** Month title between previous/next arrows (48 dp targets). */
export function MonthNav({ title, onPrevious, onNext }: MonthNavProps) {
  const t = useT();
  return (
    <View className="flex-row items-center gap-2">
      <Arrow icon={ChevronLeft} label={t("mobile.calendar.previousMonth")} onPress={onPrevious} />
      <AppText variant="h2" accessibilityRole="header" className="flex-1 text-center">
        {title}
      </AppText>
      <Arrow icon={ChevronRight} label={t("mobile.calendar.nextMonth")} onPress={onNext} />
    </View>
  );
}
