import { useT } from "../../i18n/I18nProvider.tsx";
import { AppHeader } from "../../ui/AppHeader.tsx";
import { AppText } from "../../ui/AppText.tsx";
import { ScreenScaffold } from "../../ui/ScreenScaffold.tsx";
import { ServerSection } from "../settings/ServerSection.tsx";

/**
 * Connection setup drawn ON TOP of the login, inside the auth overlay. The Settings route lives
 * under the overlay, so it is never used before sign-in.
 */
export function LoginConnectionPanel({ close }: { readonly close: () => void }) {
  const t = useT();
  return (
    <ScreenScaffold
      header={
        <AppHeader
          title={t("courier.login.connectionTitle")}
          onBack={close}
          showSync={false}
          padsStatusBar={false}
        />
      }
    >
      <AppText variant="body" tone="secondary">
        {t("courier.login.connectionBody")}
      </AppText>
      <ServerSection />
    </ScreenScaffold>
  );
}
