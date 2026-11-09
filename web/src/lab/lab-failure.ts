import { ApiError } from "@wolbachia/api-client";
export type LabFailure = { kind: "confirm" | "conflict" | "uncertain" | "rejected"; code: string };
/** Only the server decides the current plausibility limit. */
export function labFailure(error: unknown): LabFailure {
  if (!(error instanceof ApiError)) return { kind: "uncertain", code: "network" };
  const codes = Object.values(error.envelope?.fields ?? {}).flat().map((field) => field.code);
  if (error.code === "lab_confirmation_required" || codes.includes("lab_confirmation_required")) return { kind: "confirm", code: "lab_confirmation_required" };
  if (error.code === "lab_state_conflict") return { kind: "conflict", code: error.code };
  return { kind: error.status >= 500 ? "uncertain" : "rejected", code: error.code };
}
