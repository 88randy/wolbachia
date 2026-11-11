import { useTranslation } from "react-i18next";
import { useReviewReason } from "./use-review-reason";
import { InlineNotice } from "../../ui/InlineNotice";
import type { useReviewCommand } from "./use-review-command";
import { ReviewDecisionEntry } from "./ReviewDecisionEntry";

interface NoticeProps {
  command: ReturnType<typeof useReviewCommand>;
  isReceiptObserved: boolean;
}
export function ReviewCommandNotice({ command, isReceiptObserved }: NoticeProps) {
  const { t } = useTranslation();
  const reason = useReviewReason();
  if (!command.status) return null;
  return (
    <>
      <InlineNotice tone={command.status.phase === "saved" ? "success" : "warning"}>
        <span role="status">
          {t(
            command.status.phase === "saved"
              ? "reviews.workspace.saved"
              : "reviews.workspace.refreshHint",
          )}
        </span>
        {command.status.code && <span>{reason(command.status.code)}</span>}
      </InlineNotice>
      {command.status.receipt && !isReceiptObserved && (
        <ol>
          <ReviewDecisionEntry decision={command.status.receipt} />
        </ol>
      )}
    </>
  );
}
