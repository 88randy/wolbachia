import { Link, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageFrame } from "../../components/templates/PageFrame";
import { PageHeader } from "../../components/templates/PageHeader";
import { useMe } from "../../session/use-me";
import { useDocumentTitle } from "../../shell/use-document-title";
import { buttonVariants } from "../../ui/button-variants";
import { InlineNotice } from "../../ui/InlineNotice";
import { canOpenEvaluations } from "./evaluation-access";
import { useEvaluationScope } from "./use-evaluation-scope";
import { W51Workspace } from "./W51Workspace";

/** W51: evaluation sheets (presentation, execution, coverage), their results and HR notices. */
export function W51Page() {
  const { t } = useTranslation();
  const me = useMe();
  const scope = useEvaluationScope();
  const search = useSearch({ strict: false });
  const item = search["item"] ?? "";
  useDocumentTitle(t("evaluations.page.title"));
  if (!canOpenEvaluations(me, search, scope.identity.activeCenter))
    return <InlineNotice tone="warning">{t("evaluations.page.denied")}</InlineNotice>;
  const owner = JSON.stringify([me.user.id, me.organization?.slug]);
  return (
    <PageFrame>
      <PageHeader
        title={t("evaluations.page.title")}
        actions={
          <Link to="/people/trainings" className={buttonVariants({ variant: "tertiary" })}>
            {t("evaluations.page.trainings")}
          </Link>
        }
      />
      <W51Workspace key={owner} scope={scope} item={item} />
    </PageFrame>
  );
}
