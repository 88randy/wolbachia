import { Link, useSearch } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import type { InventoryReadContext } from "../inventory-read-context";
import { conditionReturnSearch } from "./condition-return-search";

/** Back to the lot and refresh: the page actions of the conditions detail. */
export function ConditionsActions({
  code,
  context,
  onReview,
}: {
  code: string;
  context: InventoryReadContext;
  onReview: () => void;
}) {
  const { t } = useTranslation();
  const search = conditionReturnSearch(context, useSearch({ strict: false }));
  return (
    <>
      <Link
        to="/inventory/lots/$code"
        params={{ code }}
        search={search}
        className="inline-flex min-h-8 items-center gap-1 text-sm font-semibold text-action"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("conditions.action.lot")}
      </Link>
      <Button variant="secondary" onClick={onReview}>
        {t("common.actions.retry")}
      </Button>
    </>
  );
}
