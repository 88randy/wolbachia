import { ApiError } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import { TransferFailureActions } from "./TransferFailureActions";
import { TransferBlockers } from "./TransferBlockers";
import { ErrorState } from "../../ui/ErrorState";
import type { useTransferWrite } from "./use-transfer-write";
export function TransferWriteError({
  write,
  waiting,
  onRetry,
}: {
  write: ReturnType<typeof useTransferWrite>;
  waiting: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const failure = write.failure;
  const code = failure instanceof ApiError ? failure.code : "network_error";
  return (
    <div>
      <InlineNotice tone="warning">{t("transfers.write.retained")}</InlineNotice>
      <ErrorState
        code={code}
        onRetry={waiting ? () => undefined : onRetry}
        message={t("transfers.write.failed")}
      />
      <TransferBlockers error={failure} />
      <TransferFailureActions write={write} waiting={waiting} />
    </div>
  );
}
