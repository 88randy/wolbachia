import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { useNotificationCommand } from "./use-notification-command";
interface Props {
  command: ReturnType<typeof useNotificationCommand>;
  id?: string;
  disabled?: boolean;
}
export function NotificationReadActions({ command, id = "all", disabled = false }: Props) {
  const { t } = useTranslation();
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-disabled={disabled || !command.isOnline || command.status === "busy"}
      onClick={() => {
        void command.issue({ type: "read", id });
      }}
    >
      {t(id === "all" ? "notifications.inbox.markAll" : "notifications.inbox.mark")}
    </Button>
  );
}
