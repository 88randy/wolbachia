import { act, waitFor } from "@testing-library/react";
import { expect } from "vitest";
import type { Query, QueryClient } from "@tanstack/react-query";
import type { RecordedRequest } from "./fake-api";
import { currentRevision } from "../session/session-revision";
import {
  ALLOWED,
  QUADRANT_ID,
  pageOf,
  point,
  quadrant,
  version,
} from "../quadrants/geography/geography-test-helpers";

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

export type ReadKind = "record" | "validation-points";
function controlledBody(kind: ReadKind, recordRevision = 1) {
  const body = barrier();
  const requested = barrier();
  const consumed = barrier();
  let isConsumed = false;
  const response = pageOf(
    kind === "record" ? [{ ...quadrant(), current_version: version(recordRevision) }] : [point()],
  );
  const text = response.text.bind(response);
  response.text = async () => {
    requested.release();
    await body.promise;
    const content = await text();
    isConsumed = true;
    consumed.release();
    return content;
  };
  return {
    response,
    consume: body.release,
    requested: requested.promise,
    consumed: consumed.promise,
    get isConsumed() {
      return isConsumed;
    },
  };
}

/** A fresh response belongs to this exact request, scope context and session epoch. */
export function controlledRead(
  request: RecordedRequest,
  kind: ReadKind,
  { context, recordRevision }: { context: string; recordRevision?: number },
) {
  const delivery = barrier();
  const body = controlledBody(kind, recordRevision);
  return {
    request,
    kind,
    context,
    revision: currentRevision(),
    reply: delivery.promise.then(() => body.response),
    deliver: delivery.release,
    consume: body.consume,
    bodyRequested: body.requested,
    bodyConsumed: body.consumed,
    get isConsumed() {
      return body.isConsumed;
    },
  };
}
export type ControlledRead = ReturnType<typeof controlledRead>;

export async function currentRead(
  reads: readonly ControlledRead[],
  kind: ReadKind,
  context: string,
) {
  let current: ControlledRead | undefined;
  await waitFor(() => {
    const active = reads.filter(
      (read) =>
        read.kind === kind &&
        read.context === context &&
        read.revision === currentRevision() &&
        !read.request.signal.aborted &&
        !read.isConsumed,
    );
    expect(active).toHaveLength(1);
    current = active[0];
  });
  if (current === undefined) throw new Error("No current geography request.");
  return current;
}

export function queryFor(client: QueryClient, kind: ReadKind, context: string) {
  const matches = client
    .getQueryCache()
    .findAll({
      exact: false,
      queryKey: [
        "org",
        ALLOWED.user.id,
        ALLOWED.organization?.slug,
        "geography",
        context,
        kind,
        kind === "record" ? "C-07" : QUADRANT_ID,
      ],
    })
    .filter((query) => query.meta?.["revision"] === currentRevision());
  expect(matches.length).toBeLessThanOrEqual(1);
  return matches[0];
}

function assertCurrentRead(read: ControlledRead, query: Query) {
  expect(read.request.signal.aborted).toBe(false);
  expect(read.revision).toBe(currentRevision());
  expect(query.queryKey[4]).toBe(read.context);
  expect(query.meta?.["revision"]).toBe(read.revision);
}

/** Observe real cache events without waitFor changing the act environment inside act. */
function acceptedQuery(client: QueryClient, read: ControlledRead) {
  const query = queryFor(client, read.kind, read.context);
  if (query === undefined) throw new Error("Missing current geography query.");
  return new Promise<void>((resolve, reject) => {
    const inspect = () => {
      try {
        assertCurrentRead(read, query);
        if (query.state.fetchStatus !== "idle") return;
        if (query.state.status === "error")
          throw new Error("Current geography query failed.", { cause: query.state.error });
        if (!read.isConsumed) return;
        expect(query.state.status).toBe("success");
        unsubscribe();
        resolve();
      } catch (failure) {
        unsubscribe();
        reject(new Error("Geography query readiness failed.", { cause: failure }));
      }
    };
    const unsubscribe = client.getQueryCache().subscribe((event) => {
      if (event.query === query) inspect();
    });
    inspect();
  });
}

export async function consumeRead(client: QueryClient, read: ControlledRead) {
  const accepted = acceptedQuery(client, read);
  await act(async () => {
    read.deliver();
    read.consume();
    await Promise.all([read.bodyConsumed, accepted]);
  });
}
