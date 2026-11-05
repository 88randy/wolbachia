import { View } from "react-native";

import type { AuthSnapshot } from "../../auth/auth-controller.ts";
import type { useUnlockForm } from "../../auth/use-unlock-form.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { PinDots } from "./PinDots.tsx";
import { PinKeypad } from "./PinKeypad.tsx";
import { createAuthStyles } from "./auth-styles.ts";
import { pinPrompt, pinErrorKey } from "./unlock-presentation.ts";

export function PinUnlock({
  snapshot,
  form,
}: {
  readonly snapshot: AuthSnapshot;
  readonly form: ReturnType<typeof useUnlockForm>;
}) {
  const t = useT();
  const styles = useStyles(createAuthStyles);
  return (
    <>
      <AppText style={styles.centered}>
        {t(pinPrompt(snapshot.phase, form.confirmation !== null))}
      </AppText>
      <PinDots
        length={form.pin.length}
        hasError={snapshot.notice !== null || form.error !== null}
      />
      {snapshot.notice !== null && snapshot.phase !== "createPin" ? (
        <AppText accessibilityLiveRegion="polite" style={[styles.centered, styles.errorText]}>
          {t(pinErrorKey(snapshot.remainingAttempts), { count: snapshot.remainingAttempts })}
        </AppText>
      ) : null}
      <View style={styles.spacer} />
      <PinKeypad {...form} />
    </>
  );
}
