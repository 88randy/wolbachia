import { Bike } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HubPage } from "../components/templates/HubPage";

/** Fleet home. The area guard already requires motorcycle.read. */
export function FleetHome() {
  const { t } = useTranslation();
  return (
    <HubPage
      title={t("shell.nav.fleet")}
      description={t("hub.fleet.description")}
      items={[
        {
          id: "motorcycles",
          icon: Bike,
          link: { to: "/fleet/motorcycles" },
          title: t("fleet.page.title"),
          description: t("hub.fleet.motorcycles"),
        },
      ]}
    />
  );
}
