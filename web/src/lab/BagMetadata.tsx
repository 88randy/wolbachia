import { useQuery } from "@tanstack/react-query";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { BagProvenance } from "./BagProvenance";
import { bagMetadataOptions } from "./bag-metadata-query";
import type { Candidate, LabScope } from "./lab-query";
/** Optional provenance never blocks the independently authorized count command. */
export function BagMetadata({ scope, bag }: { scope: LabScope; bag: Candidate }) {
  const query = useQuery(bagMetadataOptions(scope, bag));
  if (query.isPending) return <CardSkeleton />;
  if (query.isError)
    return (
      <ErrorState
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  return <BagProvenance bag={bag} facts={query.data} />;
}
