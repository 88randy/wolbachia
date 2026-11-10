import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { Button } from "../../ui/Button";
import { InlineNotice } from "../../ui/InlineNotice";
import type { OrganizationFormController } from "./use-organization-form";
import { OrganizationComparison } from "./OrganizationComparison";
/** Someone else saved first: refresh, compare and continue. No version numbers on screen. */
export function OrganizationRevision({ controller }: { controller: OrganizationFormController }) {
  const { t } = useTranslation();
  if (!controller.writer.error && !controller.comparison) return null;
  return (
    <div className="flex flex-col gap-3">
      {controller.writer.error && (
        <InlineNotice
          tone="warning"
          action={
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<RefreshCw aria-hidden="true" />}
              disabled={controller.writer.isBusy}
              onClick={() => {
                void controller.refresh();
              }}
            >
              {t("orgAdmin.revision.refresh")}
            </Button>
          }
        >
          <p role="alert">{t(controller.writer.error)}</p>
        </InlineNotice>
      )}
      <OrganizationComparison controller={controller} />
    </div>
  );
}
