import { useRef, useState } from "react";
import { useApiClient } from "../../api/ApiClientProvider";
import { useSessionGuard } from "../../session/use-session-guard";
import { downloadPermitDocument } from "../permit-document-download";

function saveBlob(blob: Blob, fileName: string) {
  const address = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = address;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(address);
}

/** One explicit authorized request per call; a session change drops the answer. */
export function usePermitDownload(permitId: string, revision: number, fileName: string) {
  const client = useApiClient();
  const begin = useSessionGuard();
  const pending = useRef(false);
  const [failed, setFailed] = useState(false);
  const download = () => {
    if (pending.current) return;
    pending.current = true;
    const guard = begin();
    downloadPermitDocument(client, { permitId, revision }, guard.signal)
      .then((blob) => {
        if (guard.isStale()) return;
        saveBlob(blob, fileName);
        setFailed(false);
      })
      .catch(() => {
        if (!guard.isStale()) setFailed(true);
      })
      .finally(() => {
        pending.current = false;
      });
  };
  return { download, failed };
}
