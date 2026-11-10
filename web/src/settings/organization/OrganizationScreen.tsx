import { useOrganizationSeed } from "./use-organization-seed";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../../api/ApiClientProvider";
import { useSessionIdentity } from "../../session/use-session-identity";
import { useDocumentTitle } from "../../shell/use-document-title";
import { PageFrame } from "../../components/templates/PageFrame";
import { PageHeader } from "../../components/templates/PageHeader";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { organizationOptions } from "./use-w-03";
import { OrganizationForm } from "./OrganizationForm";
import { AdminError } from "./AdminError";
/** W68 organization: general data, logo and the label preview. */
export function OrganizationScreen() {
  const { t } = useTranslation();
  useDocumentTitle(t("orgAdmin.organization.title"));
  const query = useQuery(
    organizationOptions({ client: useApiClient(), identity: useSessionIdentity() }),
  );
  const seed = useOrganizationSeed(query.data);
  return (
    <PageFrame>
      <PageHeader
        title={t("orgAdmin.organization.title")}
        description={t("refresh.settings.organization")}
      />
      {query.isPending && <CardSkeleton />}
      {query.isError && (
        <AdminError
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      )}
      {seed && <OrganizationForm initial={seed} />}
    </PageFrame>
  );
}
