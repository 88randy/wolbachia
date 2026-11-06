import { useOrganizationSeed } from "./use-organization-seed";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useApiClient } from "../../api/ApiClientProvider";
import { useSessionIdentity } from "../../session/use-session-identity";
import { useDocumentTitle } from "../../shell/use-document-title";
import { organizationOptions } from "./use-w-03";
import { OrganizationForm } from "./OrganizationForm";
import { PendingState } from "../../states/PendingState";
import { AdminError } from "./AdminError";
import styles from "./organization.module.css";
export function OrganizationScreen() {
  const { t } = useTranslation();
  useDocumentTitle(t("orgAdmin.organization.title"));
  const query = useQuery(
    organizationOptions({ client: useApiClient(), identity: useSessionIdentity() }),
  );
  const seed = useOrganizationSeed(query.data);
  return (
    <section className={styles.page}>
      <h1>{t("orgAdmin.organization.title")}</h1>
      {query.isPending && <PendingState />}
      {query.isError && (
        <AdminError
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      )}
      {seed && <OrganizationForm initial={seed} />}
    </section>
  );
}
