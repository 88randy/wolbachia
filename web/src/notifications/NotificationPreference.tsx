import { useTranslation } from "react-i18next";
import { NotificationChannel } from "./NotificationChannel";
import { notificationKindKey } from "./notification-labels";
import type { Preference } from "./notification-query";
import type { useNotificationCommand } from "./use-notification-command";
import styles from "./notifications.module.css";
interface Props {
  preference: Preference;
  command: ReturnType<typeof useNotificationCommand>;
  canUpdate: boolean;
}
export function NotificationPreference({ preference, command, canUpdate }: Props) {
  const { t } = useTranslation();
  return (
    <fieldset className={styles.preference}>
      <legend>{t(notificationKindKey(preference.kind))}</legend>
      <NotificationChannel {...{ preference, command, canUpdate }} channel="in_app" />
      <NotificationChannel {...{ preference, command, canUpdate }} channel="email" />
      {(preference.required_in_app || preference.required_email) && (
        <p className={styles.label}>{t("notifications.preferences.required")}</p>
      )}
    </fieldset>
  );
}
