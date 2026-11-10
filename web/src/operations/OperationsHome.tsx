import { CalendarCheck, ClipboardList, MoveRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HubPage } from "../components/templates/HubPage";
import type { HubCardItem } from "../components/templates/HubCard";
import { useCan } from "../session/use-can";

/** Operations home: reviews, relocations and closed shifts as icon cards. */
export function OperationsHome() {
  const { t } = useTranslation();
  const can = useCan();
  const items: (HubCardItem & { permission: string })[] = [
    {
      id: "reviews",
      permission: "review_item.read",
      icon: ClipboardList,
      link: { to: "/operations/reviews" },
      title: t("reviews.workspace.title"),
      description: t("hub.operations.reviews"),
    },
    {
      id: "relocations",
      permission: "relocation.read",
      icon: MoveRight,
      link: { to: "/operations/relocations" },
      title: t("relocations.workspace.title"),
      description: t("hub.operations.relocations"),
    },
    {
      id: "shifts",
      permission: "shift.read",
      icon: CalendarCheck,
      link: { to: "/operations/shifts", search: { status: "closed" } },
      title: t("shift.page.title"),
      description: t("hub.operations.shifts"),
    },
  ];
  return (
    <HubPage
      title={t("reviews.workspace.operations")}
      description={t("hub.operations.description")}
      items={items.filter((item) => can(item.permission))}
    />
  );
}
