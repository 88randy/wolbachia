import { Ban, CircleCheck, Clock, TriangleAlert } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useTheme } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";
import { KIT_ICON_STROKE, kitShadow } from "./kit-styles.ts";

export type StatusTone = "success" | "warning" | "danger" | "info";

export interface StatusCardProps {
  readonly title: string;
  /** Status in plain words, shown next to an icon (never color alone). */
  readonly statusLabel: string;
  readonly tone: StatusTone;
  /** Extra lines (dates, reasons) shown under the title. */
  readonly children?: ReactNode;
}

const ICONS: Readonly<Record<StatusTone, LucideIcon>> = {
  success: CircleCheck,
  warning: TriangleAlert,
  danger: Ban,
  info: Clock,
};

/** A fact with a state: big icon, title, status in words and a few detail lines. */
export function StatusCard({ title, statusLabel, tone, children }: StatusCardProps) {
  const { theme } = useTheme();
  const status = theme.color.status;
  const color = {
    success: status.success.fg,
    warning: status.warning.fg,
    danger: status.critical.fg,
    info: status.info.fg,
  }[tone];
  const Icon = ICONS[tone];
  return (
    <View className="gap-2 rounded-card border border-line bg-surface p-4" style={kitShadow.card}>
      <View className="flex-row items-center gap-3">
        <Icon color={color} size={28} strokeWidth={KIT_ICON_STROKE} />
        <View className="flex-1">
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText variant="caption" style={{ color }}>
            {statusLabel}
          </AppText>
        </View>
      </View>
      {children}
    </View>
  );
}
