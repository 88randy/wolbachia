import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import type { usePermitDocumentView } from "./use-permit-document-view";

interface Props {
  view: ReturnType<typeof usePermitDocumentView>;
  isBusy: boolean;
  isRetry: boolean;
  onUpload: () => void;
}

/** Selected file name and size, then the upload (or retry) action. */
export function PermitDocumentActions({ view, isBusy, isRetry, onUpload }: Props) {
  const { t } = useTranslation();
  return (
    <>
      {view.selected ? <p role="status">{view.selected}</p> : null}
      <Button variant="secondary" disabled={view.isBlocked} loading={isBusy} onClick={onUpload}>
        {t(isRetry ? "permitDocument.file.retry" : "permitDocument.file.upload")}
      </Button>
    </>
  );
}
