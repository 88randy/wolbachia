import { useTranslation } from "react-i18next";
import type { OrganizationFormController } from "./use-organization-form";
export function OrganizationComparison({ controller }: { controller: OrganizationFormController }) {
  const { t } = useTranslation();
  if (!controller.comparison) return null;
  return (
    <>
      <p>{t("orgAdmin.revision.compare")}</p>
      <pre>{JSON.stringify(controller.comparison, null, 2)}</pre>
      <button type="button" onClick={controller.review}>
        {t("orgAdmin.revision.review")}
      </button>
    </>
  );
}
