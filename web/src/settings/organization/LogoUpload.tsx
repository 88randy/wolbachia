import { useTranslation } from "react-i18next";
import { useLogoFile } from "./use-logo-file";
import type { OrganizationFormController } from "./use-organization-form";
import styles from "./organization.module.css";
interface Props {
  controller: OrganizationFormController;
  isBlocked: boolean;
}
export function LogoUpload({ controller, isBlocked }: Props) {
  const { t } = useTranslation();
  const selection = useLogoFile();
  return (
    <div className={styles.form}>
      <label htmlFor="organization-logo">{t("orgAdmin.brand.logo")}</label>
      <input
        id="organization-logo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={isBlocked}
        onChange={selection.choose}
      />
      <p>{t("orgAdmin.brand.formats")}</p>
      {selection.isInvalid && <p role="alert">{t("orgAdmin.brand.invalid")}</p>}
      <button
        type="button"
        disabled={isBlocked || !selection.file}
        onClick={() => {
          if (selection.file) void controller.upload(selection.file);
        }}
      >
        {t("orgAdmin.brand.upload")}
      </button>
    </div>
  );
}
