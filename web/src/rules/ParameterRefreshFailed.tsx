import { useTranslation } from "react-i18next";
import { InlineNotice } from "../ui/InlineNotice";
import { Button } from "../ui/Button";
export function ParameterRefreshFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="status">
      <InlineNotice
        tone="warning"
        action={
          <Button variant="secondary" onClick={onRetry}>
            {t("common.actions.retry")}
          </Button>
        }
      >
        {t("rules.detail.refreshFailed")}
      </InlineNotice>
    </div>
  );
}
