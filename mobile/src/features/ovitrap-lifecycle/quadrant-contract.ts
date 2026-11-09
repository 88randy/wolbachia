import type { Schemas } from "@wolbachia/api-client";
import {
  CourierContractError,
  choice,
  readEnvelope,
  readNonempty,
  readPositiveInteger,
  readRecord,
  readUuid,
  requireResourceIdentity,
} from "./contract-readers.ts";

export type ClosureKnowledge =
  | { readonly kind: "unknown" | "not_applicable" | "open" }
  | { readonly kind: "closed"; readonly id: string };
function closureOf(row: Record<string, unknown>): ClosureKnowledge {
  const hasClosed = "is_closed" in row;
  const hasClosure = "closure_id" in row;
  if (row.resource_type === "block") {
    if (hasClosed || hasClosure) throw new CourierContractError();
    return { kind: "not_applicable" };
  }
  if (!hasClosed && !hasClosure) return { kind: "unknown" };
  if (row.is_closed === false && row.closure_id === null) return { kind: "open" };
  if (row.is_closed === true && hasClosure) return { kind: "closed", id: readUuid(row.closure_id) };
  throw new CourierContractError();
}
/** Legacy six-field quadrants stay UNKNOWN; block references never acquire a closure. */
export function readQuadrantReference(value: unknown) {
  const row = readRecord(value);
  const reference: Schemas["QuadrantReference"] = {
    resource_type: choice(["quadrant", "block"])(row.resource_type),
    id: readUuid(row.id),
    code: readNonempty(row.code),
    center_id: readUuid(row.center_id),
    quadrant_id: readUuid(row.quadrant_id),
    revision: readPositiveInteger(row.revision),
  };
  if (reference.resource_type === "quadrant" && reference.id !== reference.quadrant_id)
    throw new CourierContractError();
  const closure = closureOf(row);
  if (closure.kind === "open" || closure.kind === "closed") {
    reference.is_closed = closure.kind === "closed";
    reference.closure_id = closure.kind === "closed" ? closure.id : null;
  }
  return { reference, closure };
}
/** Opaque publication version and integer geometry epoch remain separate facts. */
export function readQuadrantChange(value: unknown): Schemas["QuadrantChange"] {
  const change = readEnvelope(value, ["quadrant", "block"]);
  const body = readRecord(change.data);
  if (change.resource_type !== body.resource_type) throw new CourierContractError("envelope");
  requireResourceIdentity(change.resource_id, readUuid(body.id));
  const { reference } = readQuadrantReference(body);
  if (change.resource_type !== reference.resource_type) throw new CourierContractError("envelope");
  requireResourceIdentity(change.resource_id, reference.id);
  return { ...change, data: reference };
}
