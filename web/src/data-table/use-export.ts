import { useState } from "react";
import { useApiClient } from "../api/ApiClientProvider";
import { requestExport } from "./request-export";
import type { ExportFile } from "./request-export";

export type ExportStatus =
  { kind: "idle" } | { kind: "pending" } | { kind: "done" } | { kind: "failed"; error: unknown };

/** Hands the file to the browser as a download and releases the temporary address. */
function saveFile({ blob, fileName }: ExportFile): void {
  const address = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = address;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(address);
}

/**
 * Runs the export of the list in view and keeps its status for the button. One export at a
 * time: pressing again while one is pending does nothing.
 */
export function useExport(exportPath: string, query: Readonly<Record<string, string | boolean>>) {
  const client = useApiClient();
  const [status, setStatus] = useState<ExportStatus>({ kind: "idle" });
  const start = async (): Promise<void> => {
    if (status.kind === "pending") return;
    setStatus({ kind: "pending" });
    try {
      saveFile(await requestExport(client, exportPath, query));
      setStatus({ kind: "done" });
    } catch (error) {
      setStatus({ kind: "failed", error });
    }
  };
  return { status, start };
}
