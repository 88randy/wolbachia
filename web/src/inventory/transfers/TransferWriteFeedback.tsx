import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import { TransferWriteError } from "./TransferWriteError";
import { Button } from "../../ui/Button";
import { useRetryWindow } from "../../quadrants/geography/use-retry-window";
import { InventoryRateLimit } from "../inventory-failure";
import type { useTransferWrite } from "./use-transfer-write";
export function TransferWriteFeedback({
  write,
  onRetry,
}: {
  write: ReturnType<typeof useTransferWrite>;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const waiting = useRetryWindow(
    write.failure instanceof InventoryRateLimit ? write.failure.retryAt : 0,
  );
  if (write.result)
    return (
      <InlineNotice tone="success">
        <span role="status">
          {t("transfers.write.committed", { revision: write.result.revision })}
        </span>
      </InlineNotice>
    );
  if (!write.failure)
    return write.isFrozen && !write.isBusy ? (
      <Button onClick={onRetry}>{t("transfers.write.retry")}</Button>
    ) : null;
  return <TransferWriteError write={write} waiting={waiting} onRetry={onRetry} />;
}
