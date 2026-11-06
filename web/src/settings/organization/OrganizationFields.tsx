import { useTranslation } from "react-i18next";
import type { OrganizationFormController } from "./use-organization-form";
import { OrganizationTextFields } from "./OrganizationTextFields";
import { OrganizationLanguages } from "./OrganizationLanguages";
import styles from "./organization.module.css";
interface Props {
  controller: OrganizationFormController;
  canEdit: boolean;
}
export function OrganizationFields({ controller, canEdit }: Props) {
  const { t } = useTranslation();
  return (
    <fieldset disabled={!canEdit || controller.writer.isBusy} className={styles.fields}>
      <OrganizationTextFields controller={controller} />
      <label>
        {t("orgAdmin.organization.epiWeek")}
        <select
          value={controller.settings.epi_week}
          onChange={(event) => {
            controller.change("epi_week", event.target.value === "mmwr" ? "mmwr" : "iso");
          }}
        >
          <option value="iso">{t("orgAdmin.organization.iso")}</option>
          <option value="mmwr">{t("orgAdmin.organization.mmwr")}</option>
        </select>
      </label>
      <OrganizationLanguages controller={controller} />
    </fieldset>
  );
}
