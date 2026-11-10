import { ErrorState } from "../ui/ErrorState";
import { ApiError } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../ui/EmptyState";
import { TableSkeleton } from "../ui/TableSkeleton";
import { NotificationPanelRow } from "./NotificationPanelRow";
import type { NotificationPage } from "./notification-query";
import type { useNotificationCommand } from "./use-notification-command";
import styles from "./notifications.module.css";
interface Props {
  answer: NotificationPage | undefined;
  error: unknown;
  refetch: () => void;
  command: ReturnType<typeof useNotificationCommand>;
}
export function NotificationPanelContent({ answer, error, refetch, command }: Props) {
  const { t } = useTranslation();
  if (error && !answer)
    return (
      <ErrorState onRetry={refetch} code={error instanceof ApiError ? error.code : undefined} />
    );
  if (!answer) return <TableSkeleton rows={3} columns={1} />;
  if (answer.results.length === 0)
    return <EmptyState kind="noData" message={t("notifications.inbox.empty")} />;
  return (
    <ul className={styles.panelList}>
      {answer.results.map((row) => (
        <NotificationPanelRow key={row.id} row={row} command={command} />
      ))}
    </ul>
  );
}
