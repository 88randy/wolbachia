import { unwrap } from "@wolbachia/api-client";
import { orgScopedQueryOptions } from "../session/org-scoped-query";
import type { LabScope, Candidate } from "./lab-query";
async function loadBagMetadata(scope: LabScope, bag: Candidate, signal: AbortSignal) {
  const can = (permission: string) => scope.identity.permissions?.includes(permission) === true;
  if (!can("reading.read")) return {};
  const record = unwrap(
    await scope.client.GET("/api/v1/bags/{id}/", { params: { path: { id: bag.id } }, signal }),
  );
  if (!["ovitrap.read", "quadrant.read"].every(can)) return { bag: record };
  const reading = unwrap(
    await scope.client.GET("/api/v1/readings/{id}/", {
      params: { path: { id: bag.reading_id } },
      signal,
    }),
  );
  const ovitrap = unwrap(
    await scope.client.GET("/api/v1/ovitraps/{id}/", {
      params: { path: { id: reading.ovitrap } },
      signal,
    }),
  );
  const point = unwrap(
    await scope.client.GET("/api/v1/sampling-points/{id}/", {
      params: { path: { id: ovitrap.sampling_point } },
      signal,
    }),
  );
  const block = await loadBlockMetadata(scope, point.block, signal);
  return { bag: record, block };
}
export type BagMetadataResult = Awaited<ReturnType<typeof loadBagMetadata>>;

async function loadBlockMetadata(scope: LabScope, id: string, signal: AbortSignal) {
  return unwrap(
    await scope.client.GET("/api/v1/blocks/{id}/", {
      params: { path: { id } },
      signal,
    }),
  );
}

export function bagMetadataOptions(scope: LabScope, bag: Candidate) {
  return orgScopedQueryOptions(scope.identity, {
    key: ["lab", "bag", bag.id],
    queryFn: ({ signal }) => loadBagMetadata(scope, bag, signal),
  });
}
