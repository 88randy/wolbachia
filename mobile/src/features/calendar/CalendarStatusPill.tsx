import { View } from "react-native";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import type { BadgeTone } from "../../ui/Badge.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { KIT_ICON_STROKE } from "../../ui/kit-styles.ts";
import { STATUS_PRESENTATION } from "../../ui/status-presentation.ts";
import type { CalendarStatus } from "./domain.ts";

const FRAME: Readonly<Record<BadgeTone, string>> = {
  success: "bg-success-bg",
  warning: "bg-warning-bg",
  critical: "bg-danger-bg",
  info: "bg-info-bg",
  neutral: "bg-neutral-bg",
};

/** Tinted status pill: icon + words from the shared table (D4), never color alone. */
export function CalendarStatusPill({ status }: { readonly status: CalendarStatus }) {
  const t = useT();
  const { theme } = useTheme();
  const presentation = STATUS_PRESENTATION[status];
  const color = theme.color.status[presentation.tone].fg;
  const Icon = presentation.icon;
  return (
    <View
      className={`min-h-7 max-w-full flex-row items-center gap-1 self-start rounded-full px-3 py-1 ${FRAME[presentation.tone]}`}
    >
      <Icon color={color} size={16} strokeWidth={KIT_ICON_STROKE} />
      <AppText variant="status" className="shrink" style={{ color }}>
        {t(presentation.label)}
      </AppText>
    </View>
  );
}
