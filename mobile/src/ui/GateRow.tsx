import { CircleCheck, CircleX, TriangleAlert } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { useTheme } from "../theme/ThemeProvider.tsx";
import { AppText } from "./AppText.tsx";
import { KIT_ICON_STROKE } from "./kit-styles.ts";

export type GateState = "pass" | "fail" | "warn";

export interface GateRowProps {
  /** What was checked, for example "Permiso vigente". */
  readonly label: string;
  readonly state: GateState;
  /** Plain-words state next to the icon ("Listo", "Falta"). Never color alone. */
  readonly stateLabel: string;
  /** Why it is not met and who can fix it; shown only when the row is not green. */
  readonly detail?: string;
}

const FRAME: Readonly<Record<GateState, string>> = {
  pass: "bg-success-bg",
  fail: "bg-danger-bg",
  warn: "bg-warning-bg",
};

/** One check the app already made: green when it passed, red or amber with the reason when not. */
export function GateRow({ label, state, stateLabel, detail }: GateRowProps) {
  const { theme } = useTheme();
  const status = theme.color.status;
  const color = { pass: status.success.fg, fail: status.critical.fg, warn: status.warning.fg }[
    state
  ];
  const Icon: LucideIcon = { pass: CircleCheck, fail: CircleX, warn: TriangleAlert }[state];
  return (
    <View
      accessible
      accessibilityLabel={`${label}. ${stateLabel}${detail ? `. ${detail}` : ""}`}
      className={`flex-row items-start gap-3 rounded-2xl p-3 ${FRAME[state]}`}
    >
      <Icon color={color} size={26} strokeWidth={KIT_ICON_STROKE} />
      <View className="flex-1 gap-0.5">
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText variant="caption" style={{ color }}>
          {stateLabel}
        </AppText>
        {detail && state !== "pass" ? <AppText variant="body">{detail}</AppText> : null}
      </View>
    </View>
  );
}
