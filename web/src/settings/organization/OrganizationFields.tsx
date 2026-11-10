import { useTranslation } from "react-i18next";
import { SelectMenu } from "../../ui/SelectMenu";
import type { OrganizationFormController } from "./use-organization-form";
import { OrganizationTextFields } from "./OrganizationTextFields";
import { OrganizationLanguages } from "./OrganizationLanguages";
interface Props {
  controller: OrganizationFormController;
  canEdit: boolean;
}
export function OrganizationFields({ controller, canEdit }: Props) {
  const { t } = useTranslation();
  return (
    <fieldset
      disabled={!canEdit || controller.writer.isBusy}
      className="m-0 grid min-w-0 gap-4 border-0 p-0 md:grid-cols-2"
    >
      <OrganizationTextFields controller={controller} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="organization-epi-week" className="text-[13px] font-semibold text-ink">
          {t("orgAdmin.organization.epiWeek")}
        </label>
        <SelectMenu
          id="organization-epi-week"
          value={controller.settings.epi_week}
          disabled={!canEdit}
          options={[
            { value: "iso", label: t("orgAdmin.organization.iso") },
            { value: "mmwr", label: t("orgAdmin.organization.mmwr") },
          ]}
          onValueChange={(value) => {
            controller.change("epi_week", value === "mmwr" ? "mmwr" : "iso");
          }}
        />
      </div>
      <OrganizationLanguages controller={controller} />
    </fieldset>
  );
}
