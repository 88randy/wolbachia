import { ApiError, isErrorEnvelope } from "@wolbachia/api-client";
import type { SessionGuard } from "../../session/use-session-guard";
import { failureOf } from "./write-result";
import type { WriteReply, WriteOutcome, WriteFailure } from "./write-result";
const NETWORK_FAILURE: WriteFailure = {
  kind: "failed",
  key: "errors.api.network",
  code: "network",
  blocked: [],
  retryAt: 0,
};
interface Attempt<T> {
  send: (signal: AbortSignal) => Promise<WriteReply<T>>;
  guard: SessionGuard;
  report: (error: ApiError) => void;
}
export async function sendAttempt<T>({
  send,
  guard,
  report,
}: Attempt<T>): Promise<WriteOutcome<T>> {
  try {
    if (!navigator.onLine) return NETWORK_FAILURE;
    const reply = await send(guard.signal);
    if (guard.isStale()) return { kind: "stale" };
    if (reply.response.ok && reply.data !== undefined) return { kind: "saved", value: reply.data };
    const failure = failureOf(reply);
    report(
      new ApiError(reply.response.status, isErrorEnvelope(reply.error) ? reply.error : undefined),
    );
    return failure;
  } catch (caught) {
    if (guard.isStale()) return { kind: "stale" };
    console.error("Geography write failed", caught);
    return NETWORK_FAILURE;
  }
}
