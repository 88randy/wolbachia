import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
import type { InventoryFailure } from "../inventory-failure";

/** A failed write stays visible and is retried only when the user asks. */
export function FailureNotice({
  failure,
  onRetry,
}: {
  failure: InventoryFailure;
  onRetry: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const retry = onRetry && (
    <Button variant="secondary" size="sm" onClick={onRetry}>
      {t("allocation.command.retry")}
    </Button>
  );
  return (
    <div role="alert">
      <InlineNotice tone="critical" action={retry}>
        <p>{t(failure.key)}</p>
        {failure.conflict && <p>{t("allocation.command.conflictKept")}</p>}
        {failure.uncertain && <p>{t("allocation.command.uncertain")}</p>}
        <ul>
          {failure.reasons.map((reason) => (
            <li key={reason}>{t(reason)}</li>
          ))}
        </ul>
      </InlineNotice>
    </div>
  );
}
