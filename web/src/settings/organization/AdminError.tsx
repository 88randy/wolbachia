import { useTranslation } from "react-i18next";
import { tableErrorKey } from "../../data-table/table-error";
interface Props {
  error: unknown;
  onRetry: () => void;
}
export function AdminError({ error, onRetry }: Props) {
  const { t } = useTranslation();
  return (
    <div role="alert">
      <p>{t(tableErrorKey(error))}</p>
      <button type="button" onClick={onRetry}>
        {t("common.actions.retry")}
      </button>
    </div>
  );
}
