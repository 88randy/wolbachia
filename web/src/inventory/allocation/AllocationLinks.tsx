import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCan } from "../../session/use-can";

/** Entry points of W15-W17; each one is shown only to users who hold its permission. */
export function AllocationLinks() {
  const { t } = useTranslation();
  const can = useCan();
  return (
    <>
      {can("inventory.allocate") && (
        <Link to="/inventory/assignments">{t("allocation.assignment.title")}</Link>
      )}
      {can("inventory.reconcile") && (
        <Link to="/inventory/reconciliations">{t("allocation.reconciliation.title")}</Link>
      )}
      {can("inventory.write_off") && (
        <Link to="/inventory/write-offs">{t("allocation.writeOff.title")}</Link>
      )}
    </>
  );
}
