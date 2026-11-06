import { unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import type { SessionGuard } from "../../session/use-session-guard";
interface Lookup {
  dimension: "centers" | "quadrants";
  code: string;
  client: ApiClient;
  activeCenter: string;
  guard: SessionGuard;
}
export async function resolveScopeCode({ dimension, code, client, guard, activeCenter }: Lookup) {
  const query = { code: code.trim(), page: 1 };
  const answer =
    dimension === "centers"
      ? unwrap(await client.GET("/api/v1/centers/", { params: { query }, signal: guard.signal }))
      : unwrap(
          await client.GET("/api/v1/quadrants/", {
            params: { query: { ...query, ...(activeCenter ? { center: activeCenter } : {}) } },
            signal: guard.signal,
          }),
        );
  return answer.results[0] ?? null;
}
