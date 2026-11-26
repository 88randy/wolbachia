import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "../../../ui/button-variants";
import { BulkMoveStep } from "./BulkMoveStep";
import { ROW_KEYS } from "./centers-api";
import type { ReadinessRow } from "./centers-api";
import { CenterPicker, WarehousePicker } from "./DestinationPickers";
import type { CloseFlow } from "./use-close-flow";

function LinkAction({ link, label }: { link: LinkProps; label: string }) {
  return (
    <Link {...link} className={buttonVariants({ variant: "secondary" })}>
      {label}
    </Link>
  );
}

function MotorcyclesAction({ flow, count }: { flow: CloseFlow; count: number }) {
  const { t } = useTranslation();
  return (
    <BulkMoveStep
      centerId={flow.center.id}
      kind="motorcycles"
      destination={flow.destinationCenter}
      actionLabel={t("centersAdmin.closeRow.motorcyclesAction")}
      summary={t("centersAdmin.close.confirmMotorcycles", { count })}
      picker={
        <CenterPicker
          centerId={flow.center.id}
          value={flow.destinationCenter}
          onChange={flow.setDestinationCenter}
        />
      }
    />
  );
}

function StockAction({ flow }: { flow: CloseFlow }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <BulkMoveStep
        centerId={flow.center.id}
        kind="stock"
        destination={flow.destinationWarehouse}
        actionLabel={t("centersAdmin.closeRow.stockAction")}
        summary={t("centersAdmin.close.confirmStock")}
        picker={
          <WarehousePicker
            centerId={flow.center.id}
            value={flow.destinationWarehouse}
            onChange={flow.setDestinationWarehouse}
          />
        }
      />
      {flow.preparedTransfers > 0 && (
        <p className="m-0 flex flex-wrap items-center gap-2 text-sm text-ink-2">
          {t("centersAdmin.closeRow.stockPrepared", { count: flow.preparedTransfers })}
          <Link to="/inventory/transfers" className="font-semibold text-action">
            {t("centersAdmin.closeRow.stockTransfers")}
          </Link>
        </p>
      )}
    </div>
  );
}

function linkOf(key: ReadinessRow["key"], centerId: string): LinkProps | undefined {
  if (key === "open_shifts") return { to: "/operations/shifts", search: { status: "open" } };
  if (key === "active_quadrants")
    return { to: "/operations/quadrants", search: { center: centerId } };
  if (key === "people_only_here") return { to: "/settings/users" };
  return undefined;
}

/** The single action of a checklist row: a real bulk step, or a link to the screen that resolves it. */
export function CloseRowAction({ row, flow }: { row: ReadinessRow; flow: CloseFlow }) {
  const { t } = useTranslation();
  if (row.key === "motorcycles") return <MotorcyclesAction flow={flow} count={row.count} />;
  if (row.key === "stock") return <StockAction flow={flow} />;
  const link = linkOf(row.key, flow.center.id);
  if (!link) return null;
  return <LinkAction link={link} label={t(ROW_KEYS[row.key].action)} />;
}
