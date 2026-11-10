import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../shell/use-document-title";
import { InlineNotice } from "../ui/InlineNotice";
import { CardSkeleton } from "../ui/CardSkeleton";
import { NotificationTray } from "./NotificationTray";
import { NotificationPreferences } from "./NotificationPreferences";
import { notificationOwner, useNotificationScope } from "./use-notification-scope";
import page from "../styles/page.module.css";
export function W5Page() {
  const { t } = useTranslation();
  const scope = useNotificationScope();
  useDocumentTitle(t("notifications.page.title"));
  if (!scope.isAllowed)
    return <InlineNotice tone="warning">{t("notifications.page.denied")}</InlineNotice>;
  if (!scope.identity.isSettled) return <CardSkeleton />;
  return (
    <section className={page.page} key={notificationOwner(scope)}>
      <h1 className={page.title}>{t("notifications.page.title")}</h1>
      <p className={page.body}>{t("notifications.page.purpose")}</p>
      <NotificationTray scope={scope} />
      <NotificationPreferences scope={scope} />
    </section>
  );
}
