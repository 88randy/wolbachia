import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PageFrame } from "../../components/templates/PageFrame";
import { PageHeader } from "../../components/templates/PageHeader";
import { useDocumentTitle } from "../../shell/use-document-title";
import { CardSkeleton } from "../../ui/CardSkeleton";
import { ErrorState } from "../../ui/ErrorState";
import { portalSettingsOptions } from "../reg-queries";
import { useRegScope } from "../use-reg-list";
import { PortalSettingsForm } from "./PortalSettingsForm";

/** Admin switch of the public portal (W69 to W71 read what is chosen here). */
export function PortalSettingsPage() {
  const { t } = useTranslation();
  const scope = useRegScope();
  useDocumentTitle(t("regulatory.portal.title"));
  const query = useQuery({ ...portalSettingsOptions(scope), enabled: scope.identity.isSettled });
  return (
    <PageFrame width="narrow">
      <PageHeader
        title={t("regulatory.portal.title")}
        description={t("regulatory.portal.description")}
      />
      {query.data ? (
        <PortalSettingsForm key={query.data.updated_at ?? "new"} initial={query.data} />
      ) : query.isError ? (
        <ErrorState
          message={t("regulatory.common.error")}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <CardSkeleton />
      )}
    </PageFrame>
  );
}
