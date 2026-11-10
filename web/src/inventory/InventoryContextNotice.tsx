import { useTranslation } from "react-i18next";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
export function InventoryContextNotice({
  state,
  onRetry,
}: {
  state: "invalid" | "unavailable" | "readonly";
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card title={t(`inventory.context.${state}Title`)} headingLevel={1}>
      <p role={state === "readonly" ? "status" : "alert"}>{t(`inventory.context.${state}`)}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {t("inventory.action.refresh")}
        </Button>
      )}
    </Card>
  );
}
