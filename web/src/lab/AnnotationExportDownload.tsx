import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { currentRevision } from "../session/session-revision";
import { Button } from "../ui/Button";
import { buttonVariants } from "../ui/button-variants";
import type { AnnotationExport } from "./annotation-export-query";
import type { LabScope } from "./lab-query";
import { AnnotationExportRegenerate } from "./AnnotationExportRegenerate";

/** Session cookies let the browser stream the attachment directly to disk. */
// eslint-disable-next-line max-lines-per-function -- direct native link and its unavailable-state explanation stay together.
export function AnnotationExportDownload({
  row,
  scope,
}: {
  row: AnnotationExport;
  scope: LabScope;
}) {
  const { t } = useTranslation();
  if (row.status === "expired") return <AnnotationExportRegenerate row={row} scope={scope} />;
  if (row.status === "ready")
    return (
      <a
        href={`/api/v1/lab/egg-annotation-exports/${row.id}/download/`}
        download={`aedesvision-${row.id}.zip`}
        className={buttonVariants({ variant: "secondary", size: "sm" })}
        onClick={(event) => {
          if (!scope.identity.isSettled || scope.identity.revision !== currentRevision())
            event.preventDefault();
        }}
      >
        <Download aria-hidden="true" />
        {t("annotationExport.list.download")}
      </a>
    );
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="secondary"
        size="sm"
        aria-disabled
        leadingIcon={<Download aria-hidden="true" />}
      >
        {t("annotationExport.list.download")}
      </Button>
      <span className="text-xs text-ink-2">{t("annotationExport.list.notReady")}</span>
    </div>
  );
}
