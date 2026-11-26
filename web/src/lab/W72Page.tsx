import { useTranslation } from "react-i18next";
import { PageFrame } from "../components/templates/PageFrame";
import { PageHeader } from "../components/templates/PageHeader";
import { useDocumentTitle } from "../shell/use-document-title";
import { AnnotationExportForm } from "./AnnotationExportForm";
import { AnnotationExportHistory } from "./AnnotationExportHistory";
import { useLabScope } from "./use-lab-scope";

/** W72 exports verified manual annotation datasets for detector training. */
export function W72Page() {
  const { t } = useTranslation();
  const scope = useLabScope();
  useDocumentTitle(t("annotationExport.page.title"));
  return (
    <PageFrame>
      <PageHeader
        title={t("annotationExport.page.title")}
        description={t("annotationExport.page.description")}
      />
      <AnnotationExportForm key={scope.key} scope={scope} />
      <AnnotationExportHistory scope={scope} />
    </PageFrame>
  );
}
