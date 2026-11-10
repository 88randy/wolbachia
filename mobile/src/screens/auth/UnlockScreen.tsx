import { BottomActions } from "../../ui/BottomActions.tsx";
import { View } from "react-native";

import type { AuthSnapshot } from "../../auth/auth-controller.ts";
import { useUnlockForm } from "../../auth/use-unlock-form.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { Button } from "../../ui/Button.tsx";
import { UnlockContent } from "./UnlockContent.tsx";
import { createAuthStyles } from "./auth-styles.ts";

export function UnlockScreen({ snapshot }: { readonly snapshot: AuthSnapshot }) {
  const t = useT();
  const styles = useStyles(createAuthStyles);
  const form = useUnlockForm(snapshot);
  return (
    <View style={styles.root}>
      <UnlockContent snapshot={snapshot} form={form} />
      {form.canUseBiometrics ? (
        <BottomActions>
          <Button
            variant="outline"
            icon="fingerprint"
            disabled={form.isBusy}
            label={t("mobile.unlock.biometric")}
            onPress={form.biometric}
          />
        </BottomActions>
      ) : null}
    </View>
  );
}
