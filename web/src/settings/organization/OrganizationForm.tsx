import { useTranslation } from "react-i18next";
import { Card } from "../../ui/Card";
import type { Organization } from "./use-w-03";
import { useOrganizationForm } from "./use-organization-form";
import { useOrganizationAvailability } from "./use-organization-availability";
import { OrganizationFields } from "./OrganizationFields";
import { OrganizationRevision } from "./OrganizationRevision";
import { OrganizationActions } from "./OrganizationActions";
import { LabelPreview } from "./LabelPreview";
import { LogoUpload } from "./LogoUpload";
export function OrganizationForm({ initial }: { initial: Organization }) {
  const { t } = useTranslation();
  const controller = useOrganizationForm(initial);
  const availability = useOrganizationAvailability(controller);
  return (
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card title={t("orgAdmin.section.general")}>
        <form className="flex flex-col gap-5" onSubmit={availability.submit}>
          <OrganizationFields controller={controller} canEdit={availability.canEdit} />
          <OrganizationRevision controller={controller} />
          <OrganizationActions controller={controller} availability={availability} />
        </form>
      </Card>
      <div className="flex min-w-0 flex-col gap-5">
        <LogoUpload
          controller={controller}
          canEdit={availability.canEdit}
          isBlocked={availability.isBlocked}
        />
        <LabelPreview settings={controller.settings} />
      </div>
    </div>
  );
}
