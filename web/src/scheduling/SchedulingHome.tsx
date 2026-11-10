import { CalendarDays, Gauge, SprayCan, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { HubCardItem } from "../components/templates/HubCard";
import { HubPage } from "../components/templates/HubPage";
import { useCan } from "../session/use-can";

/** Scheduling home: the four planning screens as icon cards. */
export function SchedulingHome() {
  const { t } = useTranslation();
  const can = useCan();
  const items: (HubCardItem & { permission: string })[] = [
    {
      id: "plan",
      permission: "schedule.read",
      icon: CalendarDays,
      link: { to: "/scheduling/plan" },
      title: t("scheduling.plan.menu"),
      description: t("scheduling.home.plan"),
    },
    {
      id: "assignments",
      permission: "schedule.read",
      icon: Users,
      link: { to: "/scheduling/assignments" },
      title: t("scheduling.assign.title"),
      description: t("scheduling.home.assignments"),
    },
    {
      id: "risk",
      permission: "schedule.read",
      icon: Gauge,
      link: { to: "/scheduling/risk" },
      title: t("scheduling.risk.menu"),
      description: t("scheduling.home.risk"),
    },
    {
      id: "interventions",
      permission: "intervention.read",
      icon: SprayCan,
      link: { to: "/scheduling/interventions" },
      title: t("scheduling.intervention.title"),
      description: t("scheduling.home.interventions"),
    },
  ];
  return (
    <HubPage
      title={t("shell.nav.scheduling")}
      description={t("scheduling.home.description")}
      items={items.filter((item) => can(item.permission))}
    />
  );
}
