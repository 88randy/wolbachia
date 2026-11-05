import type { Organization } from "./use-w-03";
import { useOrganizationForm } from "./use-organization-form";
import { useOrganizationAvailability } from "./use-organization-availability";
import { OrganizationFields } from "./OrganizationFields";
import { OrganizationRevision } from "./OrganizationRevision";
import { OrganizationActions } from "./OrganizationActions";
import { LabelPreview } from "./LabelPreview";
import styles from "./organization.module.css";
export function OrganizationForm({ initial }: { initial: Organization }) {
  const controller = useOrganizationForm(initial);
  const availability = useOrganizationAvailability(controller);
  return (
    <div className={styles.layout}>
      <form className={styles.card} onSubmit={availability.submit}>
        <OrganizationFields controller={controller} canEdit={availability.canEdit} />
        <OrganizationRevision controller={controller} />
        <OrganizationActions controller={controller} availability={availability} />
      </form>
      <LabelPreview settings={controller.settings} />
    </div>
  );
}
