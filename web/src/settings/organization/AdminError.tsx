import { useTranslation } from "react-i18next";
import { tableErrorKey } from "../../data-table/table-error";
import { ErrorState } from "../../ui/ErrorState";
interface Props {
  error: unknown;
  onRetry: () => void;
}
export function AdminError({ error, onRetry }: Props) {
  const { t } = useTranslation();
  return <ErrorState message={t(tableErrorKey(error))} onRetry={onRetry} />;
}
