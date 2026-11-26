import { PermitDocumentActions } from "./PermitDocumentActions";
import { PermitDocumentField } from "./PermitDocumentField";
import { PERMIT_DOCUMENT_MAX_BYTES } from "./permit-document";
import { usePermitDocumentView } from "./use-permit-document-view";

interface Props {
  file: File | undefined;
  /** Already translated backend error of the last upload attempt. */
  uploadError?: string | undefined;
  isBusy: boolean;
  maxBytes?: number;
  onSelect: (file: File | undefined) => void;
  onUpload: () => void;
}

/** Presentational picker: PDF, JPEG or PNG; shows name and size before the upload. */
export function PermitDocumentPicker(props: Props) {
  const { file, uploadError, isBusy, onSelect, onUpload } = props;
  const view = usePermitDocumentView(
    file,
    props.maxBytes ?? PERMIT_DOCUMENT_MAX_BYTES,
    uploadError,
  );
  return (
    <div>
      <PermitDocumentField view={view} isBusy={isBusy} file={file} onSelect={onSelect} />
      <PermitDocumentActions
        view={view}
        isBusy={isBusy}
        isRetry={Boolean(uploadError)}
        onUpload={onUpload}
      />
    </div>
  );
}
