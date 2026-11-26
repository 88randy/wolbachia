import type { LucideIcon } from "lucide-react-native";
import { ActivityIndicator, Pressable, View } from "react-native";

import { useT } from "../i18n/I18nProvider.tsx";
import { useTheme } from "../theme/ThemeProvider.tsx";
import type { Theme } from "@wolbachia/tokens";
import { AppText } from "./AppText.tsx";
import { KIT_ICON_SIZE, KIT_ICON_STROKE } from "./kit-styles.ts";

export type KitButtonVariant = "primary" | "secondary" | "danger" | "dangerOutline";

export interface KitButtonProps {
  /** A verb: "Escanear", "Tomar foto", "Listo". */
  readonly label: string;
  readonly onPress: () => void;
  readonly icon?: LucideIcon;
  readonly disabled?: boolean;
  /** Shows a spinner and "Guardando…"; the button cannot be pressed twice. */
  readonly isLoading?: boolean;
  readonly accessibilityHint?: string;
}

const FRAME: Readonly<Record<KitButtonVariant, string>> = {
  primary: "bg-action border-action",
  secondary: "bg-surface border-action",
  danger: "bg-danger border-danger",
  dangerOutline: "bg-surface border-danger",
};
const BASE =
  "min-h-14 w-full flex-row items-center justify-center gap-2 rounded-2xl border-2 px-5 py-3 active:opacity-80";

function contentColor(theme: Theme, variant: KitButtonVariant, isInactive: boolean): string {
  if (isInactive) return theme.color.text.tertiary;
  if (variant === "dangerOutline") return theme.color.status.critical.fg;
  return variant === "secondary" ? theme.color.action : theme.color.onAction;
}

function Leading({
  icon: IconComponent,
  color,
  isLoading,
}: {
  readonly icon?: LucideIcon;
  readonly color: string;
  readonly isLoading: boolean;
}) {
  if (isLoading) return <ActivityIndicator color={color} />;
  if (!IconComponent) return null;
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <IconComponent color={color} size={KIT_ICON_SIZE} strokeWidth={KIT_ICON_STROKE} />
    </View>
  );
}

/** Shared body of PrimaryButton and SecondaryButton: 56 dp minimum, icon plus verb, full width. */
export function KitButton(props: KitButtonProps & { readonly variant: KitButtonVariant }) {
  const { variant, onPress, disabled = false, isLoading = false } = props;
  const { theme } = useTheme();
  const t = useT();
  const isInactive = disabled || isLoading;
  const color = contentColor(theme, variant, isInactive);
  const text = isLoading ? t("courier.button.loading") : props.label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityHint={props.accessibilityHint}
      accessibilityState={{ disabled: isInactive, busy: isLoading }}
      disabled={isInactive}
      onPress={onPress}
      className={`${BASE} ${isInactive ? "border-line bg-surface-muted" : FRAME[variant]}`}
    >
      <Leading icon={props.icon} color={color} isLoading={isLoading} />
      <AppText variant="button" style={{ color }}>
        {text}
      </AppText>
    </Pressable>
  );
}
