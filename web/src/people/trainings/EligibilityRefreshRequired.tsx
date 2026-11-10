import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
export function EligibilityRefreshRequired({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <InlineNotice
      tone="warning"
      action={
        <Button variant="secondary" onClick={onRetry}>
          {t("common.actions.retry")}
        </Button>
      }
    >
      {t("trainings.eligibility.refreshRequired")}
    </InlineNotice>
  );
}
