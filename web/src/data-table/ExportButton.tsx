import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import buttons from "../styles/button.module.css";
import { classNames } from "../styles/class-names";
import styles from "./filter-bar.module.css";
import { tableErrorKey } from "./table-error";
import { toFilterParams } from "./table-state";
import type { TableState } from "./table-types";
import { useExport } from "./use-export";

interface ExportButtonProps {
  /** `/api/v1/<resource>/export/`. Pass it only when the user may export. */
  exportPath: string;
  state: TableState;
}

/**
 * Export of the list as the user sees it (same filters and order). The backend builds the file,
 * applies the data-transfer authorizations (personal data it may not share comes out empty) and
 * logs the access. The result is announced; a failure is an alert.
 */
export function ExportButton({ exportPath, state }: ExportButtonProps) {
  const { t } = useTranslation();
  const { status, start } = useExport(exportPath, toFilterParams(state));
  return (
    <div className={styles.export}>
      <button
        type="button"
        className={classNames(buttons.button, buttons.secondary)}
        aria-disabled={status.kind === "pending"}
        onClick={() => {
          void start();
        }}
      >
        <Download className={styles.icon} aria-hidden="true" />
        {t("table.export.button")}
      </button>
      <p className={styles.exportStatus} role="status">
        {status.kind === "pending" && t("table.export.pending")}
        {status.kind === "done" && t("table.export.done")}
      </p>
      {status.kind === "failed" && (
        <p className={styles.exportError} role="alert">
          {t(tableErrorKey(status.error))}
        </p>
      )}
    </div>
  );
}
