import { FileBadge, FileStack, PackageCheck, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HubPage } from "../components/templates/HubPage";
import type { HubCardItem } from "../components/templates/HubCard";
import { useCan } from "../session/use-can";
import { PERMIT_MANAGE } from "./permits/permissions";
import { RELEASE_READ } from "./records/releases-query";

/** Releases home: the permit screens (W43-W45) as icon cards. */
export function ReleasesHome() {
  const { t } = useTranslation();
  const can = useCan();
  const readItems: HubCardItem[] = can(RELEASE_READ)
    ? [
        {
          id: "records",
          icon: PackageCheck,
          link: { to: "/releases/records" },
          title: t("releases.records.title"),
          description: t("hub.releases.records"),
        },
        {
          id: "devices",
          icon: Smartphone,
          link: { to: "/releases/devices" },
          title: t("releases.devices.title"),
          description: t("hub.releases.devices"),
        },
      ]
    : [];
  const permitItems: HubCardItem[] = can(PERMIT_MANAGE)
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
      items={[...readItems, ...permitItems]}
    />
  );
}
