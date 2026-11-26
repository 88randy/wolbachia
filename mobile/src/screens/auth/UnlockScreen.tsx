import { View } from "react-native";

import type { AuthSnapshot } from "../../auth/auth-controller.ts";
import { useUnlockForm } from "../../auth/use-unlock-form.ts";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { UnlockContent } from "./UnlockContent.tsx";
import { createAuthStyles } from "./auth-styles.ts";

/** The fingerprint is one key of the keypad (PinKey); there is no second button for it. */
export function UnlockScreen({ snapshot }: { readonly snapshot: AuthSnapshot }) {
  const styles = useStyles(createAuthStyles);
  const form = useUnlockForm(snapshot);
  return (
    <View style={styles.root}>
      <UnlockContent snapshot={snapshot} form={form} />
    </View>
  );
}
