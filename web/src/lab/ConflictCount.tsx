import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCan } from "../session/use-can";
import { CardSkeleton } from "../ui/CardSkeleton";
import { ErrorState } from "../ui/ErrorState";
import { ConflictCountDetails } from "./ConflictCountDetails";
import { conflictOptions } from "./lab-query";
import type { LabScope } from "./lab-query";
/** Read the current result only when authorized; 409 itself exposes no actor or timestamp. */
export function ConflictCount({ scope, code }: { scope: LabScope; code: string }) {
  const { t } = useTranslation();
  const canRead = useCan()("egg_count.read");
  const query = useQuery({
    ...conflictOptions(scope, code),
    enabled: scope.identity.isSettled && canRead,
  });
  if (!canRead) return <p>{t("lab.error.conflictHidden")}</p>;
  if (query.isPending) return <CardSkeleton />;
  if (query.isError)
    return (
      <ErrorState
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  return <ConflictCountDetails count={query.data.results[0]} />;
}
