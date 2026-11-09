import { ApiError, isErrorEnvelope } from "@wolbachia/api-client";
import type { SessionGuard } from "../../session/use-session-guard";
import type { GeographyScope } from "../../quadrants/geography/use-w-15";
import type { CloseCommand, ClosureResult } from "./use-closure-write";
interface Attempt {
  scope: GeographyScope;
  command: CloseCommand;
  guard: SessionGuard;
  report: (error: ApiError) => void;
}
export async function sendCloseAttempt({
  scope,
  command,
  guard,
  report,
}: Attempt): Promise<ClosureResult | null> {
  try {
    const reply = await scope.client.POST("/api/v1/quadrants/{id}/close/", {
      params: { path: { id: command.id } },
      body: { expected_revision: command.revision },
      signal: guard.signal,
    });
    if (guard.isStale()) return null;
    if (reply.response.ok && reply.data) return { kind: "saved", receipt: reply.data };
    const error = new ApiError(
      reply.response.status,
      isErrorEnvelope(reply.error) ? reply.error : undefined,
    );
    report(error);
    return reply.response.status === 409
      ? { kind: "conflict" }
      : { kind: "failed", code: error.code };
  } catch (caught) {
    if (guard.isStale()) return null;
    console.error("Quadrant closure failed", caught);
    return { kind: "failed", code: "network" };
  }
}
