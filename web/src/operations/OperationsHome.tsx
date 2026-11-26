import { CalendarCheck, ClipboardList, MapPinned, MoveRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { HubPage } from "../components/templates/HubPage";
import type { HubCardItem } from "../components/templates/HubCard";
import { useCan } from "../session/use-can";
import { usePendingCounts } from "./use-pending-counts";

/** Operations home: live shifts, validation, reviews and relocations, with what waits for you. */
export function OperationsHome() {
  const { t } = useTranslation();
  const can = useCan();
  const counts = usePendingCounts();
  const withCount = (count: number | undefined) =>
    count !== undefined && count > 0 ? { count, tone: "warning" as const } : {};
  const items: (HubCardItem & { permission: string })[] = [
    {
      id: "live",
      permission: "shift.read",
      icon: MapPinned,
      link: { to: "/operations/live" },
      title: t("live.title"),
      description: t("hub.operations.live"),
      ...(counts.live ? { count: counts.live, tone: "info" as const } : {}),
    },
    {
      id: "shifts",
      permission: "shift.read",
      icon: CalendarCheck,
      link: { to: "/operations/shifts", search: { status: "closed" } },
      title: t("shift.page.title"),
      description: t("hub.operations.shifts"),
    },
    {
      id: "reviews",
      permission: "review_item.read",
      icon: ClipboardList,
      link: { to: "/operations/reviews" },
      title: t("reviews.workspace.title"),
      description: t("hub.operations.reviews"),
      ...withCount(counts.reviews),
    },
    {
      id: "relocations",
      permission: "relocation.read",
      icon: MoveRight,
      link: { to: "/operations/relocations" },
      title: t("relocations.workspace.title"),
      description: t("hub.operations.relocations"),
      ...withCount(counts.relocations),
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
