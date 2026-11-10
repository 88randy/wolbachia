import { AdminSaveButton } from "./AdminSaveButton";
import { useTranslation } from "react-i18next";
import { InlineNotice } from "../../ui/InlineNotice";
import type { OrganizationFormController } from "./use-organization-form";
import type { OrganizationAvailability } from "./use-organization-availability";
interface Props {
  controller: OrganizationFormController;
  availability: OrganizationAvailability;
}
export function OrganizationActions({ controller, availability }: Props) {
  const { t } = useTranslation();
  const hasLanguages = controller.settings.languages.length > 0;
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      {!availability.isOnline && (
        <InlineNotice tone="warning">{t("orgAdmin.error.offline")}</InlineNotice>
      )}
      {!hasLanguages && (
        <InlineNotice tone="critical">
          <p role="alert">{t("orgAdmin.organization.languageRequired")}</p>
        </InlineNotice>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {availability.canEdit && (
          <AdminSaveButton
            isBlocked={availability.isBlocked || !hasLanguages}
            isBusy={controller.writer.isBusy}
          />
        )}
        <p role="status" className="m-0 text-sm font-semibold text-success-fg">
          {controller.isSaved ? t("orgAdmin.action.saved") : ""}
        </p>
      </div>
    </div>
  );
}
