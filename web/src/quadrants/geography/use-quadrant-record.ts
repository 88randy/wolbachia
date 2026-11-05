import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@wolbachia/api-client";
import type { Schemas } from "@wolbachia/api-client";
import { quadrantRecordOptions } from "./geography-query";
import type { GeographyScope } from "./use-w-15";
/** Keep the permitted record mounted under the session blocker so every in-memory form survives same-identity reauthentication.
 * The parent remount key destroys this projection when identity/scope changes. A fresh denial always hides it immediately. */
export function useQuadrantRecord(scope: GeographyScope, code: string) {
  const query = useQuery(quadrantRecordOptions(scope, code));
  const previous = useRef<Schemas["Quadrant"] | null>(null);
  const isDenied = query.error instanceof ApiError && [403, 404].includes(query.error.status);
  useEffect(() => {
    if (isDenied || query.data === null) previous.current = null;
    else if (query.data) previous.current = query.data;
  }, [isDenied, query.data]);
  const record = isDenied || query.data === null ? null : (query.data ?? previous.current);
  const refresh = async () => {
    const reply = await query.refetch();
    return reply.isError ? null : (reply.data?.current_version?.revision ?? 0);
  };
  return {
    query,
    record,
    isDenied,
    refresh,
    retry: () => {
      void query.refetch();
    },
  };
}
