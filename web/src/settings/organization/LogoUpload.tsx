import { useTranslation } from "react-i18next";
import { FileField } from "../../forms/FileField";
import { Button } from "../../ui/Button";
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
      <FileField
        id="organization-logo"
        label={t("orgAdmin.brand.logo")}
        accept="image/png,image/jpeg,image/webp"
        file={selection.file ?? undefined}
        hint={t("orgAdmin.brand.formats")}
        error={selection.isInvalid ? t("orgAdmin.brand.invalid") : undefined}
        disabled={isBlocked}
        onChange={selection.choose}
      />
      <Button
        variant="tertiary"
        disabled={isBlocked || !selection.file}
        onClick={() => {
          if (selection.file) void controller.upload(selection.file);
        }}
      >
        {t("orgAdmin.brand.upload")}
      </Button>
    </div>
  );
}
