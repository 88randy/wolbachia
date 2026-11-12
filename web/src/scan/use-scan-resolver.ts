import { useCallback } from "react";
import { unwrap } from "@wolbachia/api-client";
import type { ApiClient } from "@wolbachia/api-client";
import { useOptionalApiClient } from "../api/ApiClientProvider";
import { readScan, targetFor } from "./scan-label";
import type { ScanExpect } from "./scan-label";

export type ScanOutcome =
  | { status: "ok"; code: string }
  | { status: "supplier"; text: string }
  | { status: "wrongKind"; found: string }
  | { status: "missing" };

async function codeOfId(client: ApiClient, kind: ScanExpect, id: string): Promise<string | null> {
  try {
    if (kind === "lot") {
      return unwrap(await client.GET("/api/v1/lots/{id}/", { params: { path: { id } } })).code;
    }
    return unwrap(await client.GET("/api/v1/bags/{id}/", { params: { path: { id } } })).code;
  } catch {
    return null;
  }
}

/**
 * Turns whatever was scanned into the human code the screens look up: a printed label (by code or
 * by id), a bare code or a GS1 string. A label of another kind is reported, not looked up.
 */
export function useScanResolver(expects: ScanExpect | undefined, acceptsSupplier: boolean) {
  const client = useOptionalApiClient();
  return useCallback(
    async (raw: string): Promise<ScanOutcome> => {
      const text = raw.trim();
      if (expects === undefined || text === "") return { status: "ok", code: text };
      const target = targetFor(readScan(text), expects, acceptsSupplier);
      if (target.status === "code") return { status: "ok", code: target.code };
      if (target.status !== "id") return target;
      const code = client === null ? null : await codeOfId(client, target.kind, target.id);
      return code === null ? { status: "missing" } : { status: "ok", code };
    },
    [client, expects, acceptsSupplier],
  );
}
