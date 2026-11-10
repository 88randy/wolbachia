import { ApiError } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import type { useTransferWrite } from "./use-transfer-write";
export function TransferFailureActions({
  write,
  waiting,
}: {
  write: ReturnType<typeof useTransferWrite>;
  waiting: boolean;
}) {
  const { t } = useTranslation();
  const canReview = write.failure instanceof ApiError && [400, 409].includes(write.failure.status);
  return (
    <>
      {waiting && <p role="status">{t("transfers.write.wait")}</p>}
      {canReview && (
        <Button
          variant="secondary"
          onClick={() => {
            void write.review();
          }}
        >
          {t("transfers.write.review")}
        </Button>
      )}
    </>
  );
}
