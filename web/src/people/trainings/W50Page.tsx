import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMe } from "../../session/use-me";
import { useDocumentTitle } from "../../shell/use-document-title";
import { InlineNotice } from "../../ui/InlineNotice";
import { hasTrainingScope } from "./training-input";
import { useTrainingScope } from "./use-training-scope";
import { TrainingWorkspace } from "./TrainingWorkspace";
import styles from "./trainings.module.css";
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
  return (
    <section className={styles.page}>
      <h1>{t("trainings.workspace.title")}</h1>
      {me.permissions.some((code) => ["evaluation.read", "evaluation.create"].includes(code)) && (
        <Link to="/people/evaluations">{t("trainings.workspace.evaluations")}</Link>
      )}
      <TrainingWorkspace key={owner} scope={scope} />
    </section>
  );
}
