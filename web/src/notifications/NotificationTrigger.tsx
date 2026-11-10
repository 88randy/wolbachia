import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ComponentPropsWithRef } from "react";
import styles from "../shell/TopBar.module.css";
import inbox from "./notifications.module.css";
interface Props extends ComponentPropsWithRef<"button"> {
  count: number | undefined;
}
/** Forward primitive trigger props and ref so Radix owns focus restoration. */
export function NotificationTrigger({ count, ...props }: Props) {
  const { t } = useTranslation();
  const label =
    count === undefined
      ? t("shell.topBar.notifications")
      : `${t("shell.topBar.notifications")} · ${t("notifications.inbox.total", { count })}`;
  return (
    <button {...props} type="button" className={styles.iconButton} aria-label={label}>
      <Bell aria-hidden="true" className={styles.icon} />
      {count !== undefined && count > 0 && (
        <span aria-hidden="true" className={inbox.badge}>
          {count}
        </span>
      )}
    </button>
  );
}
