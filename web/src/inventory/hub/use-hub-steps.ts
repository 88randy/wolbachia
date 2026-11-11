import { useTranslation } from "react-i18next";
import { useCan } from "../../session/use-can";
import type { InventoryStepCardProps } from "./InventoryStepCard";
import type { InventoryHubFacts } from "./use-inventory-hub";

export type HubStep = Omit<InventoryStepCardProps, "number" | "isPrimary"> & { id: string };

/** The daily steps in the order the material really travels, for what the user may do. */
export function useHubSteps(facts: InventoryHubFacts): HubStep[] {
  const { t } = useTranslation();
  const can = useCan();
  const waiting = (facts.prepared ?? 0) + (facts.inTransit ?? 0);
  const open = facts.openDiscrepancies ?? 0;
  const steps: (HubStep | false)[] = [
    can("lot.read") && {
      id: "receive",
      title: t("hub.inventory.step.receive.title"),
      text: t("hub.inventory.step.receive.text"),
      summary:
        facts.lots === undefined
          ? ""
          : facts.lots === 0
            ? t("hub.inventory.step.receive.empty")
            : t("hub.inventory.step.receive.count", { count: facts.lots }),
      actionLabel: t("hub.inventory.step.receive.action"),
      link: { to: can("lot.create") ? "/inventory/lots/new" : "/inventory/lots" },
    },
    can("location.read") && {
      id: "stock",
      title: t("hub.inventory.step.stock.title"),
      text: t("hub.inventory.step.stock.text"),
      summary:
        facts.locations === undefined
          ? ""
          : t("hub.inventory.step.stock.count", { count: facts.locations }),
      actionLabel: t("hub.inventory.step.stock.action"),
      link: { to: "/inventory/locations" },
    },
    can("transfer.read") && {
      id: "move",
      title: t("hub.inventory.step.move.title"),
      text: t("hub.inventory.step.move.text"),
      summary: t("hub.inventory.step.move.count", {
        toSend: facts.prepared ?? 0,
        toReceive: facts.inTransit ?? 0,
      }),
      pill: waiting > 0 ? { tone: "info", label: t("hub.inventory.pill.waiting") } : undefined,
      actionLabel: t("hub.inventory.step.move.action"),
      link: { to: "/inventory/transfers" },
    },
    can("discrepancy.read") && {
      id: "differences",
      title: t("hub.inventory.step.differences.title"),
      text: t("hub.inventory.step.differences.text"),
      summary:
        open === 0
          ? t("hub.inventory.step.differences.none")
          : t("hub.inventory.step.differences.count", { count: open }),
      pill: open > 0 ? { tone: "warning", label: t("hub.inventory.pill.attention") } : undefined,
      actionLabel: t("hub.inventory.step.differences.action"),
      link: { to: "/inventory/discrepancies" },
    },
    can("inventory.allocate") && {
      id: "deliver",
      title: t("hub.inventory.step.deliver.title"),
      text: t("hub.inventory.step.deliver.text"),
      summary: "",
      actionLabel: t("hub.inventory.step.deliver.action"),
      link: { to: "/inventory/assignments" },
    },
    can("inventory.reconcile") && {
      id: "reconcile",
      title: t("hub.inventory.step.reconcile.title"),
      text: t("hub.inventory.step.reconcile.text"),
      summary: "",
      actionLabel: t("hub.inventory.step.reconcile.action"),
      link: { to: "/inventory/reconciliations" },
    },
    can("inventory.write_off") && {
      id: "writeOff",
      title: t("hub.inventory.step.writeOff.title"),
      text: t("hub.inventory.step.writeOff.text"),
      summary: "",
      actionLabel: t("hub.inventory.step.writeOff.action"),
      link: { to: "/inventory/write-offs" },
    },
  ];
  return steps.filter((step): step is HubStep => step !== false);
}
