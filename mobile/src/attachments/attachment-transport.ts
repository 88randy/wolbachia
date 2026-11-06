import { unwrap } from "@wolbachia/api-client";
import type { ApiClient, Schemas } from "@wolbachia/api-client";
import type { SessionRequests } from "../auth/session-requests.ts";
import type { ApiAnswer } from "../auth/session-requests.ts";
import { EvidenceError } from "./types.ts";
import type { EvidenceFence, OwnedEvidence } from "./types.ts";

export interface UploadCall {
  readonly attemptVersion?: number;
  readonly parentEventId?: string;
  readonly file: OwnedEvidence;
  readonly fence: EvidenceFence;
  readonly signal: AbortSignal;
}
export interface UploadGrant {
  readonly lease: string;
  readonly contentType: OwnedEvidence["contentType"];
}
export interface UploadState {
  readonly state: "authorized" | "received" | "verified";
  readonly verifiedAt: string | null;
  readonly grant: UploadGrant;
}
export interface AttachmentTransport {
  authorize(call: UploadCall): Promise<UploadState>;
  renew(call: UploadCall): Promise<UploadState>;
  put(call: UploadCall, bytes: Uint8Array, grant: UploadGrant): Promise<void>;
  finalize(call: UploadCall): Promise<string>;
}
function contextBody(call: UploadCall) {
  return call.parentEventId === undefined
    ? {}
    : { context: { kind: "field_event" as const, id: call.parentEventId } };
}
function requireLiveSignal(signal: AbortSignal): void {
  if (signal.aborted) throw new EvidenceError("upload_timeout");
}
function grantOf(input: {
  answer: Schemas["UploadAuthorization"];
  file: OwnedEvidence;
}): UploadGrant {
  const { answer, file } = input;
  // Only the server decides lease expiry; a skewed phone clock cannot invalidate a fresh grant.
  const method: unknown = answer.method;
  if (
    answer.upload_id !== file.id ||
    method !== "PUT" ||
    answer.url !== `/api/v1/field/uploads/${file.id}/content/` ||
    !Number.isFinite(Date.parse(answer.expires_at))
  )
    throw new EvidenceError("upload_authorization");
  const headers = new Headers(answer.headers);
  const lease = headers.get("upload-lease");
  if (
    [...headers.keys()].some((key) => !["content-type", "upload-lease"].includes(key)) ||
    headers.get("content-type") !== file.contentType ||
    !lease
  )
    throw new EvidenceError("upload_authorization");
  return { lease, contentType: file.contentType };
}
function verifiedAt(answer: Schemas["UploadStatus"], id: string): string {
  if (
    answer.id !== id ||
    answer.state !== "verified" ||
    answer.verified_at === null ||
    !Number.isFinite(Date.parse(answer.verified_at))
  )
    throw new EvidenceError("upload_unverified");
  return answer.verified_at;
}
/** Only generated API operations send bytes; every request and completion is session fenced. */
interface TransportDeps {
  readonly client: () => ApiClient;
  readonly requests: Pick<SessionRequests, "run">;
  readonly assertCurrent: (fence: EvidenceFence) => Promise<void>;
  readonly requireAttempt: (call: UploadCall) => Promise<void>;
  readonly requireActor: (fence: EvidenceFence) => void;
}
export class PrivateAttachmentTransport implements AttachmentTransport {
  readonly deps: TransportDeps;
  constructor(deps: TransportDeps) {
    this.deps = deps;
  }

  async #requireCall(call: UploadCall): Promise<void> {
    requireLiveSignal(call.signal);
    await this.deps.assertCurrent(call.fence);
    await this.deps.requireAttempt(call);
    requireLiveSignal(call.signal);
  }

  #run<Answer extends ApiAnswer>(
    call: UploadCall,
    execute: () => Promise<Answer>,
  ): Promise<Answer> {
    return this.deps.requests.run(async () => {
      // SessionRequests invokes this closure again AFTER shared refresh; cancellation is rechecked here.
      await this.#requireCall(call);
      this.deps.requireActor(call.fence);
      requireLiveSignal(call.signal);
      return execute();
    });
  }

  async authorize(call: UploadCall): Promise<UploadState> {
    await this.#requireCall(call);
    const client = this.deps.client();
    const answer = unwrap(
      await this.#run(call, () =>
        client.POST("/api/v1/field/uploads/", {
          body: {
            client_id: call.file.id,
            content_type: call.file.contentType,
            size_bytes: call.file.sizeBytes,
            sha256: call.file.sha256,
            ...contextBody(call),
          },
          signal: call.signal,
          redirect: "error",
          credentials: "omit",
        }),
      ),
    );
    await this.#requireCall(call);
    return {
      state: "authorized",
      verifiedAt: null,
      grant: grantOf({ answer, file: call.file }),
    };
  }

  async renew(call: UploadCall): Promise<UploadState> {
    await this.#requireCall(call);
    const client = this.deps.client();
    const answer = unwrap(
      await this.#run(call, () =>
        client.POST("/api/v1/field/uploads/{id}/renew/", {
          params: { path: { id: call.file.id } },
          signal: call.signal,
          redirect: "error",
          credentials: "omit",
        }),
      ),
    );
    await this.#requireCall(call);
    if (answer.id !== call.file.id) throw new EvidenceError("upload_identity");
    return {
      state: answer.state,
      verifiedAt: answer.state === "verified" ? verifiedAt(answer, call.file.id) : null,
      grant: grantOf({ answer, file: call.file }),
    };
  }

  async put(call: UploadCall, bytes: Uint8Array, grant: UploadGrant): Promise<void> {
    await this.#requireCall(call);
    const client = this.deps.client();
    const answer = await this.#run(call, () =>
      client.PUT("/api/v1/field/uploads/{id}/content/", {
        params: { path: { id: call.file.id }, header: { "Upload-Lease": grant.lease } },
        headers: { "Content-Type": grant.contentType },
        body: "",
        bodySerializer: () => bytes,
        signal: call.signal,
        redirect: "error",
        credentials: "omit",
      }),
    );
    unwrap(answer);
    await this.#requireCall(call);
    if (answer.response.status !== 204) throw new EvidenceError("upload_unverified");
  }

  async finalize(call: UploadCall): Promise<string> {
    await this.#requireCall(call);
    const client = this.deps.client();
    const answer = unwrap(
      await this.#run(call, () =>
        client.POST("/api/v1/field/uploads/{id}/finalize/", {
          params: { path: { id: call.file.id } },
          body: contextBody(call),
          signal: call.signal,
          redirect: "error",
          credentials: "omit",
        }),
      ),
    );
    await this.#requireCall(call);
    return verifiedAt(answer, call.file.id);
  }
}
