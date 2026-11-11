import { useState } from "react";
import type { Schemas } from "@wolbachia/api-client";
import { useApiClient } from "../api/ApiClientProvider";
import { useAdminWrite } from "../settings/organization/use-admin-write";
import { requestTemporaryPassword } from "./people-requests";

/**
 * The password lives only in this hook state: never in the query cache or a URL, and it is gone
 * when the owning panel unmounts (the dialog closes).
 */
export function useTemporaryPassword(userId: string) {
  const client = useApiClient();
  const writer = useAdminWrite();
  const [issued, setIssued] = useState<Schemas["TemporaryPassword"] | null>(null);
  async function generate() {
    const result = await writer.run((guard) =>
      requestTemporaryPassword(client, userId, guard.signal),
    );
    if (result) setIssued(result);
  }
  return { issued, generate, writer };
}
