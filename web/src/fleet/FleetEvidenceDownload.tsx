import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { unwrap } from "@wolbachia/api-client";
import { Button } from "../ui/Button";
import type { FleetRecordScope } from "./use-fleet-scope";
import { reportSessionError } from "../session/session-events";
import { useQueryClient } from "@tanstack/react-query";
interface DownloadContext {
  id: string;
  scope: FleetRecordScope;
  pending: { current: boolean };
  url: { current: string | undefined };
  cache: ReturnType<typeof useQueryClient>;
  setFailed: (value: boolean) => void;
}
function saveBytes(context: DownloadContext, bytes: Blob) {
  if (context.url.current) URL.revokeObjectURL(context.url.current);
  context.url.current = URL.createObjectURL(bytes);
  const link = document.createElement("a");
  link.href = context.url.current;
  link.download = context.id;
  link.click();
  context.setFailed(false);
}
async function download(context: DownloadContext) {
  const { scope, id } = context;
  if (context.pending.current || !scope.identity.isSettled || !scope.isCurrent()) return;
  context.pending.current = true;
  const guard = scope.begin();
  try {
    const answer = await scope.client.GET("/api/v1/attachments/{id}/download/", {
      params: { path: { id } },
      parseAs: "blob",
      signal: guard.signal,
    });
    const bytes = unwrap(answer);
    if (!guard.isStale() && scope.isCurrent()) saveBytes(context, bytes);
  } catch (error) {
    if (!guard.isStale() && scope.isCurrent()) {
      context.setFailed(true);
      reportSessionError(error, context.cache);
    }
  } finally {
    context.pending.current = false;
  }
}
/** A visible UUID is not a byte capability: B04 checks its current authenticated ACL each time. */
export function FleetEvidenceDownload({ id, scope }: { id: string; scope: FleetRecordScope }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const url = useRef<string | undefined>(undefined);
  const pending = useRef(false);
  const [failed, setFailed] = useState(false);
  useEffect(
    () => () => {
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [scope.context],
  );
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          void download({ id, scope, cache, url, pending, setFailed });
        }}
      >
        {t("fleet.evidence.download")}
      </Button>
      {failed && <p role="alert">{t("fleet.evidence.downloadFailure")}</p>}
    </>
  );
}
