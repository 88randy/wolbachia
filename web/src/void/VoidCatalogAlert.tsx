import { useTranslation } from "react-i18next";
import { ErrorState } from "../ui/ErrorState";
/** The failed catalog is scoped to this picker; retry keeps the typed reason intact. */
export function VoidCatalogAlert({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return <ErrorState message={t("voiding.error.catalogUnavailable")} onRetry={onRetry} />;
}
