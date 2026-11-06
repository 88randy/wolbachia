import { useTranslation } from "react-i18next";
import { InlineNotice } from "../ui/InlineNotice";
import { Button } from "../ui/Button";
export function TableRefreshNotice({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  if (error === null) return null;
  return (
    <InlineNotice
      tone="warning"
      action={
        <Button variant="secondary" onClick={onRetry}>
          {t("common.actions.retry")}
        </Button>
      }
    >
      {t("refresh.table.refreshFailed")}
    </InlineNotice>
  );
}
