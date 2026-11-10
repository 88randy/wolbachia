import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../../shell/use-document-title";
import { NotFoundState } from "../../states/NotFoundState";
import { useRelocationScope } from "./use-relocation-scope";
import { RelocationWorkspace } from "./RelocationWorkspace";
export function W31Page() {
  const scope = useRelocationScope();
  const { t } = useTranslation();
  useDocumentTitle(t("relocations.workspace.title"));
  if (!scope.canRead) return <NotFoundState />;
  return (
    <RelocationWorkspace
      key={`${scope.identity.userId}:${scope.identity.organizationSlug}`}
      scope={scope}
    />
  );
}
