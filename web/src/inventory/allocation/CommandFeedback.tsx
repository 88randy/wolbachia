import { useTranslation } from "react-i18next";
import type { MessageKey } from "@wolbachia/i18n";
import { InlineNotice } from "../../ui/InlineNotice";
import { FailureNotice } from "./FailureNotice";
import type { useAllocationCommand } from "./use-allocation-command";

/** Live region: results and failures are announced; offline is stated, never silently queued. */
export function CommandFeedback({
  command,
  successKey,
}: {
  command: ReturnType<typeof useAllocationCommand>;
  successKey: MessageKey;
}) {
  const { t } = useTranslation();
  const retry = command.isFrozen ? () => void command.retry() : undefined;
  return (
    <div aria-live="polite">
      {command.result && <InlineNotice tone="success">{t(successKey)}</InlineNotice>}
      {command.failure && <FailureNotice failure={command.failure} onRetry={retry} />}
      {!navigator.onLine && (
        <InlineNotice tone="warning">{t("allocation.command.offline")}</InlineNotice>
      )}
    </div>
  );
}
