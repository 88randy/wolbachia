import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { unwrap } from "@wolbachia/api-client";
import { useSessionGuard } from "../session/use-session-guard";
import { reportSessionError } from "../session/session-events";
import { Button } from "../ui/Button";
import type { IncidentScope } from "./incidents-query";
interface DownloadContext {
  scope: IncidentScope;
  id: string;
  begin: ReturnType<typeof useSessionGuard>;
  cache: ReturnType<typeof useQueryClient>;
  pending: { current: boolean };
  url: { current: string | undefined };
  setFailed: (failed: boolean) => void;
}
async function download(context: DownloadContext) {
  if (context.pending.current || !context.scope.identity.isSettled) return;
  const guard = context.begin();
  if (guard.isStale()) return;
  context.pending.current = true;
  try {
    const bytes = unwrap(
      await context.scope.client.GET("/api/v1/attachments/{id}/download/", {
        params: { path: { id: context.id } },
        parseAs: "blob",
        signal: guard.signal,
      }),
    );
    if (guard.isStale()) return;
    if (context.url.current) URL.revokeObjectURL(context.url.current);
    context.url.current = URL.createObjectURL(bytes);
    const link = document.createElement("a");
    link.href = context.url.current;
    link.download = context.id;
    link.click();
    context.setFailed(false);
  } catch (error) {
    if (!guard.isStale()) {
      context.setFailed(true);
      reportSessionError(error, context.cache);
    }
  } finally {
    context.pending.current = false;
  }
}
/** A readable audit reference is a hint; each download asks B04 for current byte authorization. */
export function IncidentEvidenceDownload({ scope, id }: { scope: IncidentScope; id: string }) {
  const { t } = useTranslation();
  const begin = useSessionGuard();
  const cache = useQueryClient();
  const pending = useRef(false);
  const url = useRef<string | undefined>(undefined);
  const [hasFailed, setFailed] = useState(false);
  useEffect(
    () => () => {
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          void download({ scope, id, begin, cache, pending, url, setFailed });
        }}
      >
        {t("incidents.evidence.download", { id })}
      </Button>
      {hasFailed && <p role="alert">{t("incidents.evidence.downloadFailed")}</p>}
    </>
  );
}
