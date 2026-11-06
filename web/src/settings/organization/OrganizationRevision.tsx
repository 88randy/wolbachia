import { useTranslation } from "react-i18next";
import type { OrganizationFormController } from "./use-organization-form";
import { OrganizationComparison } from "./OrganizationComparison";
export function OrganizationRevision({ controller }: { controller: OrganizationFormController }) {
  const { t } = useTranslation();
  return (
    <div>
      <p>
        {t("orgAdmin.revision.current")}
        {controller.settings.revision}
      </p>
      {controller.writer.error && (
        <>
          <p role="alert">{t(controller.writer.error)}</p>
          <button
            type="button"
            disabled={controller.writer.isBusy}
            onClick={() => {
              void controller.refresh();
            }}
          >
            {t("orgAdmin.revision.refresh")}
          </button>
        </>
      )}
      <OrganizationComparison controller={controller} />
    </div>
  );
}
