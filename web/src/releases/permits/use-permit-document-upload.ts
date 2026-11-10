import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@wolbachia/api-client";
import type { MessageKey } from "@wolbachia/i18n";
import { useApiClient } from "../../api/ApiClientProvider";
import { useSessionGuard } from "../../session/use-session-guard";
import { uploadErrorKey } from "../permit-document";
import { uploadPermitDocument } from "../permit-document-upload";

function failureKey(caught: unknown): MessageKey {
  const key = caught instanceof ApiError ? uploadErrorKey(caught.code) : undefined;
  return (key ?? "permits.form.documentFailed") as MessageKey;
}

/**
 * The official document of a permit version: pick, upload and keep the verified upload id until the
 * version is saved. A new file clears the previous id; a retry reuses the client id (the upload
 * endpoints are idempotent per client id).
 */
export function usePermitDocumentUpload() {
  const { t } = useTranslation();
  const client = useApiClient();
  const begin = useSessionGuard();
  const clientId = useRef(crypto.randomUUID());
  const [file, setFile] = useState<File>();
  const [uploadId, setUploadId] = useState<string>();
  const [error, setError] = useState<string>();
  const [isBusy, setBusy] = useState(false);
  const select = (next: File | undefined) => {
    clientId.current = crypto.randomUUID();
    setFile(next);
    setUploadId(undefined);
    setError(undefined);
  };
  const upload = () => {
    if (!file || isBusy) return;
    const guard = begin();
    setBusy(true);
    setError(undefined);
    uploadPermitDocument({ client, file, clientId: clientId.current, signal: guard.signal })
      .then(setUploadId, (caught: unknown) => {
        setError(t(failureKey(caught)));
      })
      .finally(() => {
        setBusy(false);
      });
  };
  return { file, uploadId, error, isBusy, select, upload };
}
