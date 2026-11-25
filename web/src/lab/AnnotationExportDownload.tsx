import { unwrap } from "@wolbachia/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { fileNameOf } from "../data-table/request-export";
import { reportSessionError } from "../session/session-events";
import { currentRevision } from "../session/session-revision";
import { useSessionGuard } from "../session/use-session-guard";
import { Button } from "../ui/Button";
import type { AnnotationExport } from "./annotation-export-query";
import type { LabScope } from "./lab-query";

function saveArchive(blob: Blob, filename: string): void {
  const address = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = address;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(address);
}

function useDownloadState(scope: LabScope, row: AnnotationExport) {
  const begin = useSessionGuard();
  const cache = useQueryClient();
  const isRunning = useRef(false);
  const [status, setStatus] = useState<"idle" | "pending" | "failed">("idle");
  return { scope, row, begin, cache, isRunning, status, setStatus };
}

async function downloadExport(state: ReturnType<typeof useDownloadState>): Promise<void> {
  if (state.row.status !== "ready" || state.isRunning.current) return;
  if (!state.scope.identity.isSettled || state.scope.identity.revision !== currentRevision())
    return;
  const guard = state.begin();
  if (guard.isStale()) return;
  state.isRunning.current = true;
  state.setStatus("pending");
  try {
    const answer = await state.scope.client.GET(
      "/api/v1/lab/egg-annotation-exports/{id}/download/",
      { params: { path: { id: state.row.id } }, parseAs: "blob", signal: guard.signal },
    );
    const blob = unwrap(answer);
    if (guard.isStale()) return;
    const disposition = answer.response.headers.get("content-disposition");
    saveArchive(blob, disposition ? fileNameOf(disposition) : `aedesvision-${state.row.id}.zip`);
    state.setStatus("idle");
  } catch (error) {
    if (guard.isStale()) return;
    reportSessionError(error, state.cache);
    state.setStatus("failed");
  } finally {
    state.isRunning.current = false;
  }
}

/** Download stays authenticated and records the receipt on the server. */
// eslint-disable-next-line max-lines-per-function -- accessible action and its inline feedback stay together.
export function AnnotationExportDownload({
  row,
  scope,
}: {
  row: AnnotationExport;
  scope: LabScope;
}) {
  const { t } = useTranslation();
  const state = useDownloadState(scope, row);
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={<Download aria-hidden="true" />}
        aria-disabled={row.status !== "ready" || undefined}
        loading={state.status === "pending"}
        onClick={() => {
          void downloadExport(state);
        }}
      >
        {t("annotationExport.list.download")}
      </Button>
      {row.status !== "ready" && (
        <span className="text-xs text-ink-2">{t("annotationExport.list.notReady")}</span>
      )}
      {state.status === "failed" && (
        <span role="alert" className="text-xs text-critical-fg">
          {t("annotationExport.error.download")}
        </span>
      )}
    </div>
  );
}
