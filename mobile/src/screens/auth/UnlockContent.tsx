import { AppScrollView } from "../../ui/AppScrollView.tsx";

import type { AuthSnapshot } from "../../auth/auth-controller.ts";
import type { useUnlockForm } from "../../auth/use-unlock-form.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { useStyles } from "../../theme/ThemeProvider.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { unlockTitle } from "./unlock-presentation.ts";
import { AuthNotice } from "./AuthNotice.tsx";
import { PasswordUnlock } from "./PasswordUnlock.tsx";
import { PinUnlock } from "./PinUnlock.tsx";
import { createAuthStyles } from "./auth-styles.ts";

export function UnlockContent({
  snapshot,
  form,
}: {
  readonly snapshot: AuthSnapshot;
  readonly form: ReturnType<typeof useUnlockForm>;
}) {
  const t = useT();
  const styles = useStyles(createAuthStyles);
  const isPasswordRequired = snapshot.isPasswordRequired && snapshot.phase !== "createPin";
  const title = unlockTitle(snapshot);
  return (
    <AppScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AppText variant="h1" style={styles.centered}>
        {t(title, { name: snapshot.profile?.firstName.trim() ?? "" })}
      </AppText>
      <AuthNotice notice={form.error} />
      {isPasswordRequired ? (
        <PasswordUnlock snapshot={snapshot} form={form} />
      ) : (
        <PinUnlock snapshot={snapshot} form={form} />
      )}
    </AppScrollView>
  );
}
