import { FlaskConical, History, PackageCheck, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HubPage } from "../components/templates/HubPage";
import type { HubCardItem } from "../components/templates/HubCard";
import { useCan } from "../session/use-can";

/** Lab home: reception, egg counts, write-offs and count history as icon cards. */
export function LabHome() {
  const { t } = useTranslation();
  const can = useCan();
  const items: (HubCardItem & { permission: string })[] = [
    {
      id: "bags",
      permission: "bag.receive",
      icon: PackageCheck,
      link: { to: "/lab/bags" },
      title: t("labReception.page.title"),
      description: t("hub.lab.bags"),
    },
    {
      id: "egg-counts",
      permission: "egg_count.create",
      icon: FlaskConical,
      link: { to: "/lab/egg-counts" },
      title: t("lab.count.title"),
      description: t("hub.lab.eggCounts"),
    },
    {
      id: "write-offs",
      permission: "bag.dispose",
      icon: Trash2,
      link: { to: "/lab/write-offs" },
      title: t("allocation.lab.title"),
      description: t("hub.lab.writeOffs"),
    },
    {
      id: "history",
      permission: "egg_count.read",
      icon: History,
      link: { to: "/lab/count-history" },
      title: t("lab.history.title"),
      description: t("hub.lab.history"),
    },
  ];
  return (
    <HubPage
      title={t("shell.nav.lab")}
      description={t("hub.lab.description")}
      items={items.filter((item) => can(item.permission))}
    />
  );
}
