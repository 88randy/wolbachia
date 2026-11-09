import { ErrorState } from "../ui/ErrorState";
import { IncidentOptionPaging } from "./IncidentOptionPaging";

interface OptionStatusProps {
  page: number;
  onPage: (page: number) => void;
  query: {
    isError: boolean;
    isFetching: boolean;
    data?: { next?: string | null };
    refetch: () => unknown;
  };
}
export function IncidentOptionStatus({ page, onPage, query }: OptionStatusProps) {
  return (
    <>
      {query.isError && (
        <ErrorState
          onRetry={() => {
            void query.refetch();
          }}
        />
      )}
      <IncidentOptionPaging
        page={page}
        hasNext={Boolean(query.data?.next) && !query.isFetching}
        onPage={onPage}
      />
    </>
  );
}
