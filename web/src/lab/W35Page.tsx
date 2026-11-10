import { useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageFrame } from "../components/templates/PageFrame";
import { PageHeader } from "../components/templates/PageHeader";
import { useDocumentTitle } from "../shell/use-document-title";
import { CountStatusChips } from "./CountStatusChips";
import { CountWorkspace } from "./CountWorkspace";
import { useLabScope } from "./use-lab-scope";

/** W35: keyboard- and scanner-first egg counting; identity-scoped and server-confirmed. */
export function W35Page() {
  const { t } = useTranslation();
  const scope = useLabScope();
  const search = useSearch({ strict: false });
  useDocumentTitle(t("lab.count.headerTitle"));
  return (
    <PageFrame>
      <PageHeader title={t("lab.count.headerTitle")} actions={<CountStatusChips scope={scope} />} />
      <CountWorkspace
        key={scope.key + JSON.stringify(search)}
        scope={scope}
        draftKey={"wolbachia:lab:" + scope.draftKey}
      />
    </PageFrame>
  );
}
