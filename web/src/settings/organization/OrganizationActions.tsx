import { AdminSaveButton } from "./AdminSaveButton";
import { useTranslation } from "react-i18next";
import type { OrganizationFormController } from "./use-organization-form";
import type { OrganizationAvailability } from "./use-organization-availability";
import { LogoUpload } from "./LogoUpload";
interface Props {
  controller: OrganizationFormController;
  availability: OrganizationAvailability;
}
export function OrganizationActions({ controller, availability }: Props) {
  const { t } = useTranslation();
  const hasLanguages = controller.settings.languages.length > 0;
  return (
    <>
      {!availability.isOnline && <p>{t("orgAdmin.error.offline")}</p>}
      {!hasLanguages && <p role="alert">{t("orgAdmin.organization.languageRequired")}</p>}
      {availability.canEdit && (
        <>
          <LogoUpload controller={controller} isBlocked={availability.isBlocked} />
          <AdminSaveButton
            isBlocked={availability.isBlocked || !hasLanguages}
            isBusy={controller.writer.isBusy}
          />
        </>
      )}
      <p role="status">{controller.isSaved ? t("orgAdmin.action.saved") : ""}</p>
      <p role="status">{controller.isLogoSaved ? t("orgAdmin.brand.saved") : ""}</p>
    </>
  );
}
