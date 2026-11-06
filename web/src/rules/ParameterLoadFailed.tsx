import { ApiError } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { ErrorState } from "../ui/ErrorState";
import { tableErrorKey } from "../data-table/table-error";
import page from "../styles/page.module.css";
export function ParameterLoadFailed({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <section className={page.page}>
      <ErrorState
        message={t(tableErrorKey(error))}
        onRetry={onRetry}
        code={error instanceof ApiError ? error.code : undefined}
      />
    </section>
  );
}
