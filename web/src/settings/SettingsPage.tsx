import {
  Bell,
  Building2,
  Contact,
  ListChecks,
  MapPinned,
  ShieldAlert,
  SlidersHorizontal,
  Smartphone,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { HubPage } from "../components/templates/HubPage";
import type { HubCardItem } from "../components/templates/HubCard";
import { useCan } from "../session/use-can";

/** Settings home: one icon card per administration screen the user may open. */
export function SettingsPage() {
  const { t } = useTranslation();
  const can = useCan();
  const items: (HubCardItem & { permission: string })[] = [
    {
      id: "organization",
      permission: "organization.read",
      icon: Building2,
      link: { to: "/settings/organization" },
      title: t("orgAdmin.organization.title"),
      description: t("refresh.settings.organization"),
    },
    {
      id: "centers",
      permission: "center.update",
      icon: MapPinned,
      link: { to: "/settings/organization/centers" },
      title: t("centersAdmin.page.title"),
      description: t("centersAdmin.page.hub"),
    },
    {
      id: "users",
      permission: "user.read",
      icon: Contact,
      link: { to: "/settings/users" },
      title: t("users.page.title"),
      description: t("users.hub.description"),
    },
    {
      id: "roles",
      permission: "role.read",
      icon: Users,
      link: { to: "/settings/roles" },
      title: t("orgAdmin.roles.title"),
      description: t("refresh.settings.roles"),
    },
    {
      id: "phones",
      permission: "device.read",
      icon: Smartphone,
      link: { to: "/settings/phones" },
      title: t("phones.page.title"),
      description: t("refresh.settings.phones"),
    },
    {
      id: "rules",
      permission: "rule_parameter_version.read",
      icon: SlidersHorizontal,
      link: { to: "/settings/rule-parameters" },
      title: t("rules.page.title"),
      description: t("refresh.settings.rules"),
    },
    {
      id: "catalogs",
      permission: "catalog.read",
      icon: ListChecks,
      link: { to: "/settings/catalogs" },
      title: t("catalogs.page.title"),
      description: t("refresh.settings.catalogs"),
    },
    {
      id: "incident-types",
      permission: "incident.manage_type",
      icon: ShieldAlert,
      link: { to: "/settings/incident-types" },
      title: t("incidentTypes.page.title"),
      description: t("hub.settings.incidentTypes"),
    },
    {
      id: "notifications",
      permission: "notification.read",
      icon: Bell,
      link: { to: "/notifications" },
      title: t("users.hub.notifications"),
      description: t("users.hub.notificationsDescription"),
    },
  ];
  return (
    <HubPage
      title={t("shell.nav.settings")}
      description={t("hub.settings.description")}
      items={items.filter((item) => can(item.permission))}
    />
  );
}
