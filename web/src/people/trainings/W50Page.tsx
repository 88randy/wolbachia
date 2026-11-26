import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageFrame } from "../../components/templates/PageFrame";
import { PageHeader } from "../../components/templates/PageHeader";
import { useMe } from "../../session/use-me";
import { useDocumentTitle } from "../../shell/use-document-title";
import { buttonVariants } from "../../ui/button-variants";
import { InlineNotice } from "../../ui/InlineNotice";
import { TrainingCreate } from "./TrainingCreate";
import { TrainingWorkspace } from "./TrainingWorkspace";
import { canPublishTraining, hasTrainingScope } from "./training-input";
import { useTrainingScope } from "./use-training-scope";

/** W50: courses, requirements by action and context, and the certifications of one person. */
export function W50Page() {
  const { t } = useTranslation();
  const me = useMe();
  const scope = useTrainingScope();
  useDocumentTitle(t("trainings.workspace.title"));
  const canRead = me.permissions.some((code) =>
    ["training.read", "training.manage"].includes(code),
  );
  if (!canRead || !hasTrainingScope(me))
    return <InlineNotice tone="warning">{t("trainings.workspace.denied")}</InlineNotice>;
  const owner = [scope.identity.userId, scope.identity.organizationSlug].join(":");
  const canEvaluate = me.permissions.some((code) =>
    ["evaluation.read", "evaluation.create"].includes(code),
  );
  return (
    <PageFrame>
      <PageHeader
        title={t("trainings.workspace.title")}
        actions={
          <>
            {canEvaluate && (
              <Link to="/people/evaluations" className={buttonVariants({ variant: "tertiary" })}>
                {t("trainings.workspace.evaluations")}
              </Link>
            )}
            {canPublishTraining(me) && <TrainingCreate scope={scope} />}
          </>
        }
      />
      <TrainingWorkspace key={owner} scope={scope} />
    </PageFrame>
  );
}
