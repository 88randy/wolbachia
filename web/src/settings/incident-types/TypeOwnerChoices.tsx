import { Skeleton } from "../../ui/Skeleton";
import { ErrorState } from "../../ui/ErrorState";
import { TypeOwnerSelect } from "./TypeOwnerSelect";
import type { OwnerFieldController } from "./use-owner-field";
import type { OwnerFieldProps } from "./owner-field-types";
export function TypeOwnerChoices({
  controller,
  ...props
}: OwnerFieldProps & { controller: OwnerFieldController }) {
  const { query, selected } = controller;
  const failed = query.error ? query : selected;
  if (failed.error)
    return (
      <ErrorState
        onRetry={() => {
          void failed.refetch();
        }}
      />
    );
  if (!query.data) return <Skeleton />;
  return (
    <TypeOwnerSelect
      {...props}
      choices={query.data.results}
      selected={selected.data?.results[0]}
      isLoading={query.isFetching}
    />
  );
}
