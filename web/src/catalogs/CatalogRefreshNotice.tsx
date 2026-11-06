import { useTranslation } from "react-i18next";
import { InlineNotice } from "../ui/InlineNotice";
import { Button } from "../ui/Button";
interface Props {
  error: Error | null;
  onRetry: () => Promise<unknown>;
}
/** A failed refresh never unmounts the editor or its retained dialog draft. */
export function CatalogRefreshNotice({ error, onRetry }: Props) {
  const { t } = useTranslation();
  if (error === null) return null;
  return (
    <div role="status">
      <InlineNotice
        tone="warning"
        action={
          <Button
            variant="secondary"
            onClick={() => {
              void onRetry();
            }}
          >
            {t("common.actions.retry")}
          </Button>
        }
      >
        {t("catalogs.page.refreshFailed")}
      </InlineNotice>
    </div>
  );
}
