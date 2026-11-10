import { useTranslation } from "react-i18next";
import { HomeDashboard } from "../components/templates/HomeDashboard";
import { HubGrid } from "../components/templates/HubGrid";
import { useMe } from "../session/use-me";
import { displayNameOf } from "../shell/user-display";
import { useHomeShortcuts } from "./use-home-shortcuts";

/**
 * W1 Home. Greets the user and opens every area they may use. Profile-specific pending cards
 * plug into `HomeDashboard.pending` when each screen agent exposes its pending counts.
 */
export function HomePage() {
  const { t } = useTranslation();
  const { user } = useMe();
  const shortcuts = useHomeShortcuts();
  return (
    <HomeDashboard
      title={t("hub.home.greeting", { name: displayNameOf(user) })}
      description={t("hub.home.subtitle")}
    >
      <section aria-labelledby="home-shortcuts" className="flex flex-col gap-3">
        <h2 id="home-shortcuts" className="m-0 text-base font-semibold">
          {t("hub.home.shortcuts")}
        </h2>
        <HubGrid items={shortcuts} label={t("hub.home.shortcuts")} />
      </section>
    </HomeDashboard>
  );
}
