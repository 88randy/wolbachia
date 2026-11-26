import { Delete, Fingerprint } from "lucide-react-native";
import { Pressable } from "react-native";

import { useT } from "../../i18n/I18nProvider.tsx";
import { useTheme } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { KIT_ICON_STROKE } from "../../ui/kit-styles.ts";
import { pressPinKey } from "./pin-keypad-model.ts";
import type { PinKeypadProps } from "./pin-keypad-model.ts";

interface PinKeyProps {
  readonly value: number;
  readonly actions: PinKeypadProps;
}
export function PinKey({ value, actions }: PinKeyProps) {
  const { theme } = useTheme();
  const t = useT();
  const label = value >= 0 ? String(value) : t(pinKeyLabel(value));
  const isHidden = value === -1 && !actions.canUseBiometrics;
  const Icon = value === -1 ? Fingerprint : Delete;
  return (
    <Pressable
      className={`min-h-16 flex-1 items-center justify-center rounded-2xl border border-line active:opacity-70 ${isHidden ? "" : "bg-surface"}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityElementsHidden={isHidden}
      importantForAccessibility={isHidden ? "no-hide-descendants" : "auto"}
      disabled={actions.isBusy || isHidden}
      onPress={() => {
        pressPinKey(value, actions);
      }}
    >
      {value >= 0 ? (
        <AppText variant="h2">{label}</AppText>
      ) : (
        !isHidden && (
          <Icon color={theme.color.text.primary} size={28} strokeWidth={KIT_ICON_STROKE} />
        )
      )}
    </Pressable>
  );
}

function pinKeyLabel(value: number) {
  return value === -1 ? ("mobile.unlock.biometric" as const) : ("mobile.unlock.erase" as const);
}
