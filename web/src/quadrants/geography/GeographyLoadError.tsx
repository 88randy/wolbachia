import { useTranslation } from "react-i18next";
import { tableErrorKey } from "../../data-table/table-error";
interface Props {
  error: unknown;
  retry: () => void;
}
export function GeographyLoadError({ error, retry }: Props) {
  const { t } = useTranslation();
  return (
    <div role="alert">
      <p>{t(tableErrorKey(error))}</p>
      <button type="button" onClick={retry}>
        {t("common.actions.retry")}
      </button>
    </div>
  );
}
