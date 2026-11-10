import { FileBadge, FileStack } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HubPage } from "../components/templates/HubPage";
import type { HubCardItem } from "../components/templates/HubCard";
import { useCan } from "../session/use-can";
import { PERMIT_MANAGE } from "./permits/permissions";

/** Releases home: the permit screens (W43-W45) as icon cards. */
export function ReleasesHome() {
  const { t } = useTranslation();
  const can = useCan();
  const items: HubCardItem[] = can(PERMIT_MANAGE)
    ? [
        {
          id: "permits",
          icon: FileBadge,
          link: { to: "/releases/permits" },
          title: t("permits.list.title"),
          description: t("hub.releases.permits"),
        },
        {
          id: "permit-types",
          icon: FileStack,
          link: { to: "/releases/permit-types" },
          title: t("permits.types.title"),
          description: t("hub.releases.permitTypes"),
        },
      ]
    : [];
  return (
    <HubPage
      title={t("shell.nav.releases")}
      description={t("hub.releases.description")}
      items={items}
    />
  );
}
