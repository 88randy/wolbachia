import { ApiError, unwrap } from "@wolbachia/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useApiClient } from "../../api/ApiClientProvider";
import { invalidateOrgScoped } from "../../session/org-scoped-query";
import { reportSessionError } from "../../session/session-events";
import { fileNameOf } from "../../data-table/request-export";

export type Dataset = "releases" | "readings" | "lab_results";
export type FileFormat = "csv" | "xlsx";

export interface ExportRequest {
  dataset: Dataset;
  format: FileFormat;
  from: string;
  to: string;
  recipient: string;
}

export type ExportStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "done" }
  | { kind: "failed"; reason: "tooMany" | "invalid" | "generic" };

function save(blob: Blob, fileName: string): void {
  const address = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = address;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(address);
}

/** The backend builds the file (RFC only with an authorization) and writes the receipt. */
export function useOfficialExport() {
  const client = useApiClient();
  const cache = useQueryClient();
  const [status, setStatus] = useState<ExportStatus>({ kind: "idle" });
  const start = async (request: ExportRequest): Promise<void> => {
    if (status.kind === "pending") return;
    setStatus({ kind: "pending" });
    try {
      const result = await client.GET("/api/v1/export/", {
        params: {
          query: {
            dataset: request.dataset,
            file_format: request.format,
            date_from: request.from,
            date_to: request.to,
            ...(request.recipient === "" ? {} : { recipient_institution: request.recipient }),
          },
        },
        parseAs: "blob",
      });
      const blob = unwrap(result);
      save(blob, fileNameOf(result.response.headers.get("content-disposition")));
      void invalidateOrgScoped(cache, "regulatory");
      setStatus({ kind: "done" });
    } catch (error) {
      reportSessionError(error, cache);
      const fields = error instanceof ApiError ? error.envelope?.fields : undefined;
      const code = fields?.["date_to"]?.[0]?.code;
      setStatus({
        kind: "failed",
        reason: code === "too_many_rows" ? "tooMany" : code === undefined ? "generic" : "invalid",
      });
    }
  };
  return { status, start };
}
