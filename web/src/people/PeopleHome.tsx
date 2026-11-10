import { ClipboardCheck, GraduationCap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HubPage } from "../components/templates/HubPage";
import type { HubCardItem } from "../components/templates/HubCard";
import { useCan } from "../session/use-can";

/** People home: trainings and evaluations as icon cards. */
export function PeopleHome() {
  const { t } = useTranslation();
  const can = useCan();
  const items: (HubCardItem & { permissions: readonly string[] })[] = [
    {
      id: "trainings",
      permissions: ["training.read", "training.manage"],
      icon: GraduationCap,
      link: { to: "/people/trainings" },
      title: t("evaluations.page.trainings"),
      description: t("hub.people.trainings"),
    },
    {
      id: "evaluations",
      permissions: ["evaluation.read", "evaluation.create"],
      icon: ClipboardCheck,
      link: { to: "/people/evaluations" },
      title: t("evaluations.page.title"),
      description: t("hub.people.evaluations"),
    },
  ];
  return (
    <HubPage
      title={t("evaluations.page.people")}
      description={t("hub.people.description")}
      items={items.filter((item) => item.permissions.some((code) => can(code)))}
    />
  );
}
