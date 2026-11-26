import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import type { Count } from "./lab-query";
export function AnnotationCorrectionLink({ count, isLocked }: { count: Count; isLocked: boolean }) {
  const { t } = useTranslation();
  const canAnnotate = useCan()("egg_count.create");
  return canAnnotate && count.bag_code && !isLocked ? (
    <Link
      to="/lab/egg-counts/$bagCode/annotate"
      params={{ bagCode: count.bag_code }}
      search={{ correction: "true" }}
    >
      {t("labAnnotation.editor.action")}
    </Link>
  ) : null;
}
