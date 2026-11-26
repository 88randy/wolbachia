import { ArrowRight } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";

import { useT } from "../i18n/I18nProvider.tsx";
import { useTheme } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";
import { kitShadow, KIT_ICON_STROKE } from "./kit-styles.ts";

export interface BigActionCardProps {
  readonly title: string;
  readonly body?: string;
  readonly icon: LucideIcon;
  /** Verb of the button inside the card; omit it for a finished state with nothing to do. */
  readonly actionLabel?: string;
  readonly onPress?: () => void;
  readonly disabled?: boolean;
  /** Defaults to "Lo que sigue". */
  readonly eyebrow?: string;
}

interface CardButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled: boolean;
}

function CardButton({ label, onPress, disabled }: CardButtonProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-14 flex-row items-center justify-center gap-2 rounded-2xl bg-surface px-5 active:opacity-80 ${disabled ? "opacity-60" : ""}`}
    >
      <AppText variant="button" style={{ color: theme.color.action }}>
        {label}
      </AppText>
      <ArrowRight color={theme.color.action} size={24} strokeWidth={KIT_ICON_STROKE} />
    </Pressable>
  );
}

function CardText({
  eyebrow,
  title,
  body,
}: Pick<BigActionCardProps, "eyebrow" | "title" | "body">) {
  const t = useT();
  const { theme } = useTheme();
  const color = theme.color.onAction;
  return (
    <View className="flex-1 gap-1">
      <AppText variant="overline" style={{ color }}>
        {eyebrow ?? t("courier.next.eyebrow")}
      </AppText>
      <AppText variant="h2" accessibilityRole="header" style={{ color }}>
        {title}
      </AppText>
      {body ? <AppText style={{ color }}>{body}</AppText> : null}
    </View>
  );
}

/** The "Lo que sigue" card: the next task, big and blue, with one button that opens it. */
export function BigActionCard(props: BigActionCardProps) {
  const { icon: IconComponent, actionLabel, onPress } = props;
  const { theme } = useTheme();
  return (
    <View className="gap-4 rounded-card bg-action p-5" style={kitShadow.raised}>
      <View className="flex-row items-start gap-3">
        <View className="h-14 w-14 items-center justify-center rounded-2xl bg-action-strong">
          <IconComponent color={theme.color.onAction} size={30} strokeWidth={KIT_ICON_STROKE} />
        </View>
        <CardText eyebrow={props.eyebrow} title={props.title} body={props.body} />
      </View>
      {actionLabel !== undefined && onPress !== undefined ? (
        <CardButton label={actionLabel} onPress={onPress} disabled={props.disabled ?? false} />
      ) : null}
    </View>
  );
}
