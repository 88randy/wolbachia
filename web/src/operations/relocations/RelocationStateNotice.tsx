import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
export function RelocationStateNotice({
  isBlocked,
  isOnline,
}: {
  isBlocked: boolean;
  isOnline: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      {isBlocked && (
        <InlineNotice tone="warning">{t("relocations.workspace.blocked")}</InlineNotice>
      )}
      {!isOnline && (
        <InlineNotice tone="warning">{t("relocations.workspace.offline")}</InlineNotice>
      )}
    </>
  );
}
