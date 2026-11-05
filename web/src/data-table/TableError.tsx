import { ApiError } from "@wolbachia/api-client";
import { useTranslation } from "react-i18next";
import { ErrorState } from "../ui/ErrorState";
import { Button } from "../ui/Button";
import { tableErrorKey } from "./table-error";
interface TableErrorProps {
  error: unknown;
  onRetry: () => void;
  onFirstPage: (() => void) | undefined;
}
export function TableError({ error, onRetry, onFirstPage }: TableErrorProps) {
  const { t } = useTranslation();
  return (
    <>
      <ErrorState
        message={t(tableErrorKey(error))}
        code={error instanceof ApiError ? error.code : undefined}
        onRetry={onRetry}
      />
      {onFirstPage && (
        <Button variant="secondary" onClick={onFirstPage}>
          {t("table.pager.first")}
        </Button>
      )}
    </>
  );
}
