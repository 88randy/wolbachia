import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export function AnnotationUnavailable() {
  const { t } = useTranslation();
  return (
    <>
      <p role="status">{t("labAnnotation.editor.noBag")}</p>
      <Link to="/lab/egg-counts" search={{}}>
        {t("labAnnotation.editor.back")}
      </Link>
    </>
  );
}
