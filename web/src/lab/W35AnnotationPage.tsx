import { useParams, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useDocumentTitle } from "../shell/use-document-title";
import { readTableState } from "../data-table/table-state";
import { queueContext } from "./lab-query";
import { QUEUE_TABLE } from "./lab-table";
import { useLabScope } from "./use-lab-scope";
import { AnnotationQueueTarget } from "./AnnotationQueueTarget";
import { AnnotationCorrectionTarget } from "./AnnotationCorrectionTarget";

export function W35AnnotationPage() {
  const scope = useLabScope();
  const { bagCode } = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const { t } = useTranslation();
  useDocumentTitle(t("labAnnotation.editor.heading", { code: bagCode ?? "" }));
  if (!bagCode) return null;
  return search.correction === "true" ? (
    <AnnotationCorrectionTarget key={scope.key + bagCode} scope={scope} code={bagCode} />
  ) : (
    <AnnotationQueueTarget
      key={scope.key + bagCode}
      scope={scope}
      code={bagCode}
      context={queueContext(scope, readTableState(search, QUEUE_TABLE).state)}
    />
  );
}
