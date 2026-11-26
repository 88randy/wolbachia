import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { AnnotationExport } from "./annotation-export-query";
import type { LabScope } from "./lab-query";
import { useAnnotationExportCreate } from "./use-annotation-export-create";

/** Expiry removes only archive bytes; the retained filters can request another job. */
// eslint-disable-next-line max-lines-per-function -- declarative action and its inline status/error feedback.
export function AnnotationExportRegenerate({
  row,
  scope,
}: {
  row: AnnotationExport;
  scope: LabScope;
}) {
  const { t } = useTranslation();
  const command = useAnnotationExportCreate(scope);
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="secondary"
        size="sm"
        loading={command.status === "pending"}
        onClick={() => {
          void command.submit({
            date_from: row.date_from,
            date_to: row.date_to,
            author: row.author,
            include_voided: row.include_voided,
            format: row.format,
          });
        }}
      >
        {t("annotationExport.list.regenerate")}
      </Button>
      {command.failure && (
        <span role="alert" className="text-xs text-critical-fg">
          {t(command.failure.key, command.failure.params)}
        </span>
      )}
      {command.status === "queued" && (
        <span role="status" className="text-xs text-ink-2">
          {t("annotationExport.form.queued")}
        </span>
      )}
    </div>
  );
}
