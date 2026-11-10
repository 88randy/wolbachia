import { Link } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageFrame } from "../components/templates/PageFrame";
import { PageHeader } from "../components/templates/PageHeader";
import { useCan } from "../session/use-can";
import { useDocumentTitle } from "../shell/use-document-title";
import { buttonVariants } from "../ui/button-variants";
import { CountHistory } from "./CountHistory";
import { useLabScope } from "./use-lab-scope";

/** Count history: every attempt is kept; corrections are voids with a reason. */
export function W35HistoryPage() {
  const { t } = useTranslation();
  const scope = useLabScope();
  const canCreate = useCan()("egg_count.create");
  useDocumentTitle(t("lab.history.title"));
  return (
    <PageFrame>
      <PageHeader
        title={t("lab.history.title")}
        actions={
          canCreate && (
            <Link to="/lab/egg-counts" className={buttonVariants({ variant: "primary" })}>
              <FlaskConical aria-hidden="true" className="size-4" />
              {t("lab.count.title")}
            </Link>
          )
        }
      />
      <CountHistory key={scope.key} scope={scope} draftKey={"wolbachia:lab:" + scope.draftKey} />
    </PageFrame>
  );
}
