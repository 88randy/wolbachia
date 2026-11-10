import { Link, useSearch } from "@tanstack/react-router";
import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageFrame } from "../components/templates/PageFrame";
import { PageHeader } from "../components/templates/PageHeader";
import { useCan } from "../session/use-can";
import { useDocumentTitle } from "../shell/use-document-title";
import { buttonVariants } from "../ui/button-variants";
import { CountWorkspace } from "./CountWorkspace";
import { useLabScope } from "./use-lab-scope";

/** W35: keyboard- and scanner-first egg counting; identity-scoped and server-confirmed. */
export function W35Page() {
  const { t } = useTranslation();
  const scope = useLabScope();
  const search = useSearch({ strict: false });
  const canRead = useCan()("egg_count.read");
  useDocumentTitle(t("lab.count.title"));
  return (
    <PageFrame>
      <PageHeader
        title={t("lab.count.title")}
        description={t("lab.count.intro")}
        actions={
          canRead && (
            <Link to="/lab/count-history" className={buttonVariants({ variant: "secondary" })}>
              <History aria-hidden="true" className="size-4" />
              {t("lab.history.title")}
            </Link>
          )
        }
      />
      <CountWorkspace
        key={scope.key + JSON.stringify(search)}
        scope={scope}
        draftKey={"wolbachia:lab:" + scope.draftKey}
      />
    </PageFrame>
  );
}
