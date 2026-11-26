import type { useLoginForm } from "../../auth/use-login-form.ts";
import { useT } from "../../i18n/I18nProvider.tsx";
import { Button } from "../../ui/Button.tsx";

/** A bound phone exposes no connection setup on the login screen; the panel opens on top. */
export function LoginServerSetup({ form }: { readonly form: ReturnType<typeof useLoginForm> }) {
  const t = useT();
  if (!form.canConfigureServer) return null;
  return (
    <Button variant="text" label={t("mobile.login.serverSettings")} onPress={form.toggleServer} />
  );
}
