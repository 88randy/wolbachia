import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
import type { OrganizationFormController } from "./use-organization-form";
export function OrganizationComparison({ controller }: { controller: OrganizationFormController }) {
  const { t } = useTranslation();
  if (!controller.comparison) return null;
  return (
    <InlineNotice
      tone="info"
      action={
        <Button size="sm" variant="secondary" onClick={controller.review}>
          {t("orgAdmin.revision.review")}
        </Button>
      }
    >
      <p>{t("orgAdmin.revision.compare")}</p>
    </InlineNotice>
  );
}
