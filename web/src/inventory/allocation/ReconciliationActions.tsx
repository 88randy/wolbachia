import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import type { ReconciliationRow } from "./reconciliation-equation";

/** Justify and open-discrepancy exist only for a nonzero, already signed equation. */
export function ReconciliationActions({
  row,
  canJustify,
  onJustify,
}: {
  row: ReconciliationRow;
  canJustify: boolean;
  onJustify: (row: ReconciliationRow) => void;
}) {
  const { t } = useTranslation();
  if (row.state !== "difference") return null;
  return (
    <span>
      {canJustify && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            onJustify(row);
          }}
        >
          {t("allocation.reconciliation.justify")}
        </Button>
      )}
      <Link to="/inventory/discrepancies">{t("allocation.reconciliation.openDiscrepancy")}</Link>
    </span>
  );
}
