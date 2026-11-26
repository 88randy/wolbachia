import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../../api/ApiClientProvider";
import { parameterQueryOptions } from "../../rules/rules-query";
import { useSessionIdentity } from "../../session/use-session-identity";

/** Where the courier signs a delivery, from the organization rule: 0 either, 1 warehouse, 2 phone. */
export type SignatureMode = "either" | "warehouse" | "phone";

export function useSignatureMode(): SignatureMode {
  const client = useApiClient();
  const identity = useSessionIdentity();
  const query = useQuery(parameterQueryOptions(client, identity, "delivery_signature_mode"));
  const value = query.data?.value ?? 0;
  return value === 1 ? "warehouse" : value === 2 ? "phone" : "either";
}
