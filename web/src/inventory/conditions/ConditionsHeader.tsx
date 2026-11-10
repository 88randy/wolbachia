import { Link, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import type { InventoryReadContext } from "../inventory-read-context";
import styles from "../inventory.module.css";
import { conditionReturnSearch } from "./condition-return-search";
export function ConditionsHeader({
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
    <Card title={`${t("conditions.page.title")} · ${code}`} headingLevel={1}>
      <div className={styles.actions}>
        <Link to="/inventory/lots/$code" params={{ code }} search={search}>
          {t("conditions.action.lot")}
        </Link>
        <Button variant="secondary" onClick={onReview}>
          {t("common.actions.retry")}
        </Button>
      </div>
    </Card>
  );
}
