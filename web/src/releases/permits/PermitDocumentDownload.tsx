import { useTranslation } from "react-i18next";
import { Button } from "../../ui/Button";
import { usePermitDownload } from "./use-permit-download";

interface Props {
  permitId: string;
  revision: number;
  fileName: string;
}

/** Authorized download of the version's official document. */
export function PermitDocumentDownload({ permitId, revision, fileName }: Props) {
  const { t } = useTranslation();
  const { download, failed } = usePermitDownload(permitId, revision, fileName);
  return (
    <>
      <Button variant="secondary" onClick={download}>
        {t("permits.document.download")}
      </Button>
      {failed && <p role="alert">{t("permits.document.failed")}</p>}
    </>
  );
}
