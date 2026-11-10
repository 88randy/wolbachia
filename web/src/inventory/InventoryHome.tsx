import {
  ArrowLeftRight,
  Boxes,
  ClipboardCheck,
  FileWarning,
  MapPin,
  PackageMinus,
  PackageOpen,
  Truck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { HubPage } from "../components/templates/HubPage";
import type { HubCardItem } from "../components/templates/HubCard";
import { useCan } from "../session/use-can";

/** Inventory home: one card per screen the user may open. */
export function InventoryHome() {
  const { t } = useTranslation();
  const can = useCan();
  const items: (HubCardItem & { permission: string })[] = [
    {
      id: "transfers",
      permission: "transfer.read",
      icon: Truck,
      link: { to: "/inventory/transfers" },
      title: t("transfers.page.title"),
      description: t("hub.inventory.transfers"),
    },
    {
      id: "discrepancies",
      permission: "discrepancy.read",
      icon: FileWarning,
      link: { to: "/inventory/discrepancies" },
      title: t("discrepancies.page.title"),
      description: t("hub.inventory.discrepancies"),
    },
    {
      id: "assignments",
      permission: "inventory.allocate",
      icon: ArrowLeftRight,
      link: { to: "/inventory/assignments" },
      title: t("allocation.assignment.title"),
      description: t("hub.inventory.assignments"),
    },
    {
      id: "reconciliations",
      permission: "inventory.reconcile",
      icon: ClipboardCheck,
      link: { to: "/inventory/reconciliations" },
      title: t("allocation.reconciliation.title"),
      description: t("hub.inventory.reconciliations"),
    },
    {
      id: "write-offs",
      permission: "inventory.write_off",
      icon: PackageMinus,
      link: { to: "/inventory/write-offs" },
      title: t("allocation.writeOff.title"),
      description: t("hub.inventory.writeOffs"),
    },
    {
      id: "supplies",
      permission: "supply_type.read",
      icon: PackageOpen,
      link: { to: "/inventory/supplies" },
      title: t("inventory.page.supplies"),
      description: t("hub.inventory.supplies"),
    },
    {
      id: "lots",
      permission: "lot.read",
      icon: Boxes,
      link: { to: "/inventory/lots" },
      title: t("inventory.page.lots"),
      description: t("hub.inventory.lots"),
    },
    {
      id: "locations",
      permission: "location.read",
      icon: MapPin,
      link: { to: "/inventory/locations" },
      title: t("inventory.page.locations"),
      description: t("hub.inventory.locations"),
    },
  ];
  return (
    <HubPage
      title={t("inventory.page.home")}
      description={t("hub.inventory.description")}
      items={items.filter((item) => can(item.permission))}
    />
  );
}
