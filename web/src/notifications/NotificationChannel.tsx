import { useTranslation } from "react-i18next";
import { Switch } from "../ui/Switch";
import type { Preference } from "./notification-query";
import type { useNotificationCommand } from "./use-notification-command";
interface Props {
  preference: Preference;
  command: ReturnType<typeof useNotificationCommand>;
  canUpdate: boolean;
  channel: "in_app" | "email";
}
export function NotificationChannel({ preference, command, canUpdate, channel }: Props) {
  const { t } = useTranslation();
  const required = channel === "in_app" ? preference.required_in_app : preference.required_email;
  const disabled = !canUpdate || !command.isOnline || command.status === "busy" || required;
  return (
    <Switch
      label={t(
        channel === "in_app"
          ? "notifications.preferences.inApp"
          : "notifications.preferences.email",
      )}
      isOn={preference[channel]}
      disabled={disabled}
      onChange={(value) => {
        void command.issue({ type: "preference", preference: { ...preference, [channel]: value } });
      }}
    />
  );
}
