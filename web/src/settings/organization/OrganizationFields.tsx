import { useTranslation } from "react-i18next";
import { Select } from "../../forms/Select";
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
      <Select
        id="organization-epi-week"
        label={t("orgAdmin.organization.epiWeek")}
        value={controller.settings.epi_week}
        options={[
          { value: "iso", label: t("orgAdmin.organization.iso") },
          { value: "mmwr", label: t("orgAdmin.organization.mmwr") },
        ]}
        onChange={(event) => {
          controller.change("epi_week", event.target.value === "mmwr" ? "mmwr" : "iso");
        }}
      />
      <OrganizationLanguages controller={controller} />
    </fieldset>
  );
}
