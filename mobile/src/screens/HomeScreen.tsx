import { P3Screen } from "../features/shift-open/P3Screen.tsx";
import { useServices } from "../app/services-context.ts";
import { useT } from "../i18n/I18nProvider.tsx";
import { AppHeader } from "../ui/AppHeader.tsx";
import { InfoNotice } from "../ui/InfoNotice.tsx";
import { ScreenScaffold } from "../ui/ScreenScaffold.tsx";
import { useFirstName } from "./use-first-name.ts";

/** "Mi día": greeting, sync chip, what's next and the courier's actions, with the bottom tabs. */
export function HomeScreen() {
  const t = useT();
  const { server } = useServices();
  const name = useFirstName();
  return (
    <ScreenScaffold
      tab="day"
      header={
        <AppHeader
          onBack={null}
          subtitle={t("courier.app.name")}
          title={name ? t("courier.home.greeting", { name }) : t("courier.home.greetingNeutral")}
        />
      }
    >
      {server.baseUrl() === null ? (
        <InfoNotice tone="warning" message={t("mobile.home.serverMissing")} />
      ) : null}
      <P3Screen />
    </ScreenScaffold>
  );
}
