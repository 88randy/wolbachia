import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";

import { useTheme } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";
import { KIT_ICON_STROKE } from "./kit-styles.ts";
import { PrimaryButton } from "./PrimaryButton.tsx";

export interface EmptyStateProps {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly message?: string;
  /** One clear action; omit both when there is truly nothing to do. */
  readonly actionLabel?: string;
  readonly actionIcon?: LucideIcon;
  readonly onAction?: () => void;
}

/** Nothing to show yet: a calm icon, one sentence and at most one action. */
export function EmptyState({
  icon: IconComponent,
  title,
  message,
  actionLabel,
  actionIcon,
  onAction,
}: EmptyStateProps) {
  const { theme } = useTheme();
  return (
    <View className="items-center gap-4 px-6 py-10">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-tint">
        <IconComponent color={theme.color.action} size={40} strokeWidth={KIT_ICON_STROKE} />
      </View>
      <View className="items-center gap-1">
        <AppText variant="h2" accessibilityRole="header" className="text-center">
          {title}
        </AppText>
        {message ? (
          <AppText variant="body" tone="secondary" className="text-center">
            {message}
          </AppText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} icon={actionIcon} onPress={onAction} />
      ) : null}
    </View>
  );
}
