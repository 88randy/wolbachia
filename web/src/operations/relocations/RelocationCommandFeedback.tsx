import { useTranslation } from "react-i18next";
import { ApiError } from "@wolbachia/api-client";
import { ErrorState } from "../../ui/ErrorState";
import { Button } from "../../ui/Button";
import { tableErrorKey } from "../../data-table/table-error";
import type { useRelocationCommand } from "./use-relocation-command";
import { snapshotText } from "./relocation-snapshot";
interface FeedbackProps {
  command: ReturnType<typeof useRelocationCommand>;
  isFetching: boolean;
  onRefresh: () => void;
}
export function RelocationCommandFeedback({ command, isFetching, onRefresh }: FeedbackProps) {
  const { t } = useTranslation();
  const failure = command.failure;
  const blockers =
    failure?.error instanceof ApiError ? failure.error.envelope?.blocked_by : undefined;
  const message = failure?.isConflict
    ? "relocations.workspace.conflict"
    : tableErrorKey(failure?.error);
  return (
    <>
      <Button variant="secondary" onClick={onRefresh} loading={isFetching}>
        {t("relocations.workspace.refresh")}
      </Button>
      {failure && <ErrorState code={failure.code} message={t(message)} onRetry={onRefresh} />}
      {blockers && (
        <details>
          <summary>{t("relocations.workspace.blockers")}</summary>
          <p>{snapshotText(blockers)}</p>
        </details>
      )}
    </>
  );
}
