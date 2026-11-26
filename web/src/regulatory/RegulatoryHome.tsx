import { Clock, FileDown, Globe, History, Inbox, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { HubCardItem } from "../components/templates/HubCard";
import { HubPage } from "../components/templates/HubPage";
import { can } from "../session/can";
import { useMe } from "../session/use-me";

/** Regulatory home: one card per screen the user may open. */
export function RegulatoryHome() {
  const { t } = useTranslation();
  const me = useMe();
  const candidates: (HubCardItem | false)[] = [
    can(me, "transfer_authorization.read") && {
      id: "transfers",
      icon: Share2,
      link: { to: "/regulatory/data-transfers" },
      title: t("regulatory.page.transfers"),
      description: t("regulatory.home.transfers"),
    },
    can(me, "export.run") && {
      id: "exports",
      icon: FileDown,
      link: { to: "/regulatory/exports" },
      title: t("regulatory.page.exports"),
      description: t("regulatory.home.exports"),
    },
    can(me, "arco_request.read") && {
      id: "arco",
      icon: Inbox,
      link: { to: "/regulatory/arco-requests" },
      title: t("regulatory.page.arco"),
      description: t("regulatory.home.arco"),
    },
    can(me, "access_log.read") && {
      id: "access-log",
      icon: History,
      link: { to: "/regulatory/access-log" },
      title: t("regulatory.page.accessLog"),
      description: t("regulatory.home.accessLog"),
    },
    can(me, "access_log.read") && {
      id: "retention",
      icon: Clock,
      link: { to: "/regulatory/retention" },
      title: t("regulatory.page.retention"),
      description: t("regulatory.home.retention"),
    },
    can(me, "portal.manage") && {
      id: "portal",
      icon: Globe,
      link: { to: "/regulatory/portal-settings" },
      title: t("regulatory.page.portal"),
      description: t("regulatory.home.portal"),
    },
  ];
  return (
    <HubPage
      title={t("shell.nav.regulatory")}
      description={t("regulatory.home.description")}
      items={candidates.filter((item) => item !== false)}
    />
  );
}
