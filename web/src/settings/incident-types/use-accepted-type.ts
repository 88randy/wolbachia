import { useEffect, useState } from "react";
import { isTypeAccessDenied } from "./type-access";
import type { TypeTarget } from "./incident-types-query";
import { isCurrentTypeRead } from "./type-query-state";
import type { TypeSelectionQuery } from "./type-query-state";
interface Accepted {
  code: string;
  item: TypeTarget | undefined;
}
/** A permitted RAM reference keeps drafts mounted during same-identity reauthentication. */
export function useAcceptedType(code: string, query: TypeSelectionQuery) {
  const [accepted, setAccepted] = useState<Accepted>();
  const canAccept = isCurrentTypeRead(query);
  const item = query.data?.results.find((candidate) => candidate.code === code);
  const hasNoMatch = query.data !== undefined && !query.isPlaceholderData && item === undefined;
  useEffect(() => {
    if (isTypeAccessDenied(query.error) || hasNoMatch) setAccepted(undefined);
    else if (canAccept)
      setAccepted((previous) =>
        previous?.code === code && previous.item === item ? previous : { code, item },
      );
  }, [canAccept, code, item, query.error, hasNoMatch]);
  if (hasNoMatch) return undefined;
  return canAccept ? item : accepted?.code === code ? accepted.item : undefined;
}
