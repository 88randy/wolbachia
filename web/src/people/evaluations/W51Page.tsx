import { useSearch, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMe } from "../../session/use-me";
import { useDocumentTitle } from "../../shell/use-document-title";
import { InlineNotice } from "../../ui/InlineNotice";
import { W51Workspace } from "./W51Workspace";
import { useEvaluationScope } from "./use-evaluation-scope";
import { canOpenEvaluations } from "./evaluation-access";
import styles from "./evaluations.module.css";
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
    <section className={styles.page}>
      <h1>{t("evaluations.page.title")}</h1>
      <p>{t("evaluations.page.hint")}</p>
      <nav aria-label={t("evaluations.page.people")}>
        <Link to="/people">{t("evaluations.page.people")}</Link>
      </nav>
      <W51Workspace key={owner} scope={scope} item={item} />
    </section>
  );
}
