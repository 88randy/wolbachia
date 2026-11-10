import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
export function TypeAvailabilityNotice({
  isOnline,
  isReady,
  isSettled,
}: {
  isOnline: boolean;
  isReady: boolean;
  isSettled: boolean;
}) {
  const { t } = useTranslation();
  if (!isOnline)
    return <InlineNotice tone="warning">{t("incidentTypes.form.offline")}</InlineNotice>;
  if (!isReady || !isSettled)
    return <InlineNotice>{t("incidentTypes.form.verifying")}</InlineNotice>;
  return null;
}
