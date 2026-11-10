import type { Schemas } from "@wolbachia/api-client";
import type { SqlStatement } from "../../db/sql.ts";
import type { CaptureTransportHandle } from "../ovitrap-lifecycle/capture-context-contract.ts";

export type SupplyAssignment = Schemas["SupplyBundle"];
export type SupplyProjectionAccess = "receive" | "reconcile";
export class SupplyProjectionUnavailable extends Error {
  readonly code = "scope";
}
export type SupplyRelease = Schemas["SupplyReleaseBundle"];
export type SupplyExpectedLine = Schemas["AssignmentLine"];
export interface SupplyProjectionSource {
  readonly assignments: readonly SupplyAssignment[];
  readonly handle: CaptureTransportHandle;
  /** SELECT predicate. Every local write must assert EXISTS in its own transaction. */
  readonly guard: SqlStatement;
}
