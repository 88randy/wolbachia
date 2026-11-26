import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";
import { KIT_ICON_STROKE } from "./kit-styles.ts";

export type InfoNoticeTone = "info" | "success" | "warning" | "danger";

export interface InfoNoticeProps {
  readonly message: string;
  readonly title?: string;
  readonly tone?: InfoNoticeTone;
  /** Overrides the tone's default icon. */
  readonly icon?: LucideIcon;
  /** A short text button inside the banner, on the right ("Activar"). */
  readonly action?: InfoNoticeAction;
}

export interface InfoNoticeAction {
  readonly label: string;
  readonly onPress: () => void;
}

const ICONS: Readonly<Record<InfoNoticeTone, LucideIcon>> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleX,
};
const FRAME: Readonly<Record<InfoNoticeTone, string>> = {
  info: "bg-info-bg",
  success: "bg-success-bg",
  warning: "bg-warning-bg",
  danger: "bg-danger-bg",
};

/** Calm inline message: tinted box, icon and words (never color alone). Announced politely. */
export function InfoNotice({ message, title, tone = "info", icon, action }: InfoNoticeProps) {
  const { theme } = useTheme();
  const status = theme.color.status;
  const color = {
    info: status.info.fg,
    success: status.success.fg,
    warning: status.warning.fg,
    danger: status.critical.fg,
  }[tone];
  const IconComponent = icon ?? ICONS[tone];
  return (
    <View
      accessibilityLiveRegion="polite"
      className={`flex-row gap-3 rounded-2xl ${action ? "items-center py-2 pl-4 pr-2" : "items-start p-4"} ${FRAME[tone]}`}
    >
      <IconComponent color={color} size={22} strokeWidth={KIT_ICON_STROKE} />
      <View className="flex-1 gap-0.5">
        {title ? (
          <AppText variant="bodyStrong" style={{ color }}>
            {title}
          </AppText>
        ) : null}
        <AppText variant="body">{message}</AppText>
      </View>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          className="min-h-12 min-w-12 items-center justify-center rounded-xl px-3 active:opacity-80"
        >
          <AppText variant="bodyStrong" style={{ color }}>
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
