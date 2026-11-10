import { useState } from "react";
import { useApiClient } from "../api/ApiClientProvider";

type RevealState =
  { kind: "hidden" } | { kind: "loading" } | { kind: "shown"; rfc: string } | { kind: "failed" };

/**
 * Showing an RFC is an explicit action that the backend logs. The value lives only in this
 * component's state: it never enters the query cache, storage or the URL, and Hide drops it.
 */
export function useRfcReveal(personId: string) {
  const client = useApiClient();
  const [state, setState] = useState<RevealState>({ kind: "hidden" });
  const reveal = async () => {
    setState({ kind: "loading" });
    const reply = await client.POST("/api/v1/users/{id}/reveal-rfc/", {
      params: { path: { id: personId } },
    });
    setState(reply.data ? { kind: "shown", rfc: reply.data.rfc } : { kind: "failed" });
  };
  return {
    state,
    reveal: () => void reveal(),
    hide: () => {
      setState({ kind: "hidden" });
    },
  };
}
