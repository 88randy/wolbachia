import { Link, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
export function AnnotationCountLink({ code, isLocked }: { code: string; isLocked: boolean }) {
  const { t } = useTranslation();
  const search = useSearch({ strict: false });
  const parameters: Record<string, string> = {};
  for (const [key, value] of Object.entries(search))
    if (typeof value === "string") parameters[key] = value;
  return !isLocked ? (
    <Link to="/lab/egg-counts/$bagCode/annotate" params={{ bagCode: code }} search={parameters}>
      {t("labAnnotation.editor.action")}
    </Link>
  ) : null;
}
