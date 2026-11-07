import { ApiError, isErrorEnvelope, unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import { normalizeReason, countCharacters, hasForbiddenCharacters } from "../void/count-characters";
import type { VoidLimits } from "../void/void-limits";
export type FleetCommand =
  | { kind: "service"; motorcycle: string; body: Schemas["ServiceWriteRequest"] }
  | { kind: "clear"; motorcycle: string; body: Schemas["ClearanceRequest"] };
export type OperationFailure = "invalid" | "conflict" | "uncertain" | "retry" | "denied";
const MAX_ODOMETER = 999999;
const MAX_INTERVAL = 2147483647;
const MAX_NOTES = 1000;
export function invalidServiceField(name: string, value: string) {
  if (name === "kind") return !["routine", "repair", "inspection"].includes(value);
  if (name === "notes") return Array.from(value).length > MAX_NOTES;
  if (name === "performed_at") return invalidDate(value);
  if (value === "" && name !== "odometer_km") return false;
  try {
    integer(
      value,
      name === "odometer_km" ? MAX_ODOMETER : MAX_INTERVAL,
      name === "odometer_km" ? 0 : 1,
    );
    return false;
  } catch {
    return true;
  }
}
function invalidDate(value: string) {
  return (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  );
}
export function serviceErrors(values: Readonly<Record<string, string>>) {
  return Object.fromEntries(
    [
      "kind",
      "performed_at",
      "odometer_km",
      "notes",
      "service_interval_km",
      "service_interval_days",
    ].map((name) => [name, invalidServiceField(name, values[name] ?? "")]),
  );
}
function integer(value: string, maximum: number, minimum = 0) {
  const parsed = /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new Error("Invalid service integer");
  return parsed;
}
/** Blank maintenance intervals stay explicitly unconfigured; none is inferred from the motorcycle. */
export function serviceBody(
  values: Readonly<Record<string, string>>,
): Schemas["ServiceWriteRequest"] {
  const kind = values["kind"];
  const date = values["performed_at"] ?? "";
  const notes = values["notes"] ?? "";
  if (kind !== "routine" && kind !== "repair" && kind !== "inspection")
    throw new Error("Invalid service kind");
  if (Object.values(serviceErrors(values)).some(Boolean)) throw new Error("Invalid service fields");
  return {
    kind,
    performed_at: date,
    odometer_km: integer(values["odometer_km"] ?? "", MAX_ODOMETER),
    notes,
    service_interval_km: values["service_interval_km"]
      ? integer(values["service_interval_km"], MAX_INTERVAL, 1)
      : null,
    service_interval_days: values["service_interval_days"]
      ? integer(values["service_interval_days"], MAX_INTERVAL, 1)
      : null,
  };
}
export function clearanceReason(reason: string, limits: VoidLimits) {
  const normalized = normalizeReason(reason);
  if (
    countCharacters(normalized) < limits.minLength ||
    Array.from(normalized).length > limits.maxLength ||
    hasForbiddenCharacters(normalized)
  )
    throw new Error("Invalid clearance reason");
  return normalized;
}
/** A server delay unlocks only a manual action; it cannot settle an unknown write. */
export class FleetRateLimit extends ApiError {
  readonly retryAt: number;
  constructor(response: Response, error: unknown) {
    super(response.status, isErrorEnvelope(error) ? error : undefined);
    const header = response.headers.get("Retry-After") ?? "";
    const time = /^\d+$/.test(header) ? Date.now() + Number(header) * 1000 : Date.parse(header);
    this.retryAt = Number.isFinite(time) ? time : 0;
  }
}
export function fleetReply<D>(reply: { data?: D; error?: unknown; response: Response }): D {
  if ([429, 503].includes(reply.response.status))
    throw new FleetRateLimit(reply.response, reply.error);
  return unwrap(reply);
}
/** These are the only two new writes. No request retries or invented revision fields. */
export async function sendFleetCommand(
  client: ApiClient,
  command: FleetCommand,
  signal: AbortSignal,
) {
  if (command.kind === "service")
    return fleetReply(
      await client.POST("/api/v1/motorcycles/{motorcycle_id}/services/", {
        params: { path: { motorcycle_id: command.motorcycle } },
        body: command.body,
        signal,
      }),
    );
  return fleetReply(
    await client.POST("/api/v1/motorcycles/{id}/clear-fault/", {
      params: { path: { id: command.motorcycle } },
      body: command.body,
      signal,
    }),
  );
}
export function operationFailure(error: unknown): OperationFailure {
  if (!(error instanceof ApiError)) return "uncertain";
  if (error.status === 403 || error.status === 404) return "denied";
  if (error.status === 409) return "conflict";
  if (error.status === 400) return "invalid";
  return [401, 429].includes(error.status) ? "retry" : "uncertain";
}
