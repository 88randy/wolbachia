import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { apiError } from "../../test/fake-api";
import type { RecordedRequest } from "../../test/fake-api";
import { fakePassword } from "../../test/fake-credentials";
import { currentRevision } from "../../session/session-revision";
import { geographyContext } from "./permissions";
import {
  ALLOWED,
  QUADRANT_ID,
  openGeography,
  pageOf,
  point,
  quadrant,
  version,
} from "./geography-test-helpers";
vi.mock("./GeographyMap", () => ({ default: () => <div role="region" aria-label="Map" /> }));
const PUBLISH = `POST /api/v1/quadrants/${QUADRANT_ID}/versions/`;
const PUBLISH_NAME = "Publicar nueva versi\u00f3n";
const COORDINATES_NAME = "Pol\u00edgono (longitud, latitud)";
const DRAFT = "0,0\n5,0\n5,5\n0,5\n0,0";
const SELECTED = {
  ...ALLOWED,
  scope: {
    centers: { mode: "selected" as const, ids: ["center-north"] },
    quadrants: { mode: "selected" as const, ids: [QUADRANT_ID] },
  },
};

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

type ReadKind = "record" | "validation-points";
/** Delivery and body consumption are distinct: resolving fetch alone is not query readiness. */
function controlledRead(request: RecordedRequest, kind: ReadKind, context: string) {
  const delivery = barrier();
  const body = barrier();
  const requested = barrier();
  const consumed = barrier();
  const response = pageOf(kind === "record" ? [quadrant()] : [point()]);
  const text = response.text.bind(response);
  response.text = async () => {
    requested.release();
    await body.promise;
    const content = await text();
    consumed.release();
    return content;
  };
  return {
    request,
    kind,
    context,
    reply: delivery.promise.then(() => response),
    deliver: delivery.release,
    consume: body.release,
    bodyRequested: requested.promise,
    bodyConsumed: consumed.promise,
  };
}
type ControlledRead = ReturnType<typeof controlledRead>;

async function currentRead(reads: readonly ControlledRead[], kind: ReadKind, context: string) {
  let current: ControlledRead | undefined;
  await waitFor(() => {
    const active = reads.filter(
      (read) => read.kind === kind && read.context === context && !read.request.signal.aborted,
    );
    expect(active).toHaveLength(1);
    current = active[0];
  });
  if (current === undefined) throw new Error("No current geography request.");
  return current;
}

function queryFor(client: QueryClient, kind: ReadKind, context: string) {
  return client.getQueryCache().find({
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
  });
}

async function consume(read: ControlledRead) {
  await act(async () => {
    read.deliver();
    read.consume();
    await read.bodyConsumed;
  });
}

describe("geography reauthentication", () => {
  test.each(["unchanged scope", "still-permitted scope refresh"])(
    "retains a permitted draft after 401, never replays it, and enables a new manual attempt: %s",
    async (scopeChange) => {
      const reads: ControlledRead[] = [];
      let context = geographyContext(ALLOWED) + "|";
      let shouldHoldReads = false;
      const reply = (request: RecordedRequest, kind: ReadKind) => {
        if (!shouldHoldReads) return pageOf(kind === "record" ? [quadrant()] : [point()]);
        const read = controlledRead(request, kind, context);
        reads.push(read);
        return read.reply;
      };
      const { api, app } = await openGeography({
        routes: {
          [PUBLISH]: apiError(401, "not_authenticated"),
          "GET /api/v1/quadrants/": (request) => reply(request, "record"),
          "GET /api/v1/sampling-points/": (request) => reply(request, "validation-points"),
          "POST /api/v1/auth/login/": () => {
            shouldHoldReads = true;
            return Response.json({ me: ALLOWED, server_time: "2026-11-04T12:00:00Z" });
          },
        },
      });
      const writes = () =>
        api.requests.filter(({ method, path }) => method === "POST" && path.endsWith("/versions/"));
      document.cookie = "csrftoken=test-csrf; path=/";
      const coordinates = await screen.findByRole<HTMLTextAreaElement>("textbox", {
        name: COORDINATES_NAME,
      });
      fireEvent.change(coordinates, { target: { value: DRAFT } });
      await waitFor(() => {
        expect(screen.getByRole("button", { name: PUBLISH_NAME }).hasAttribute("disabled")).toBe(
          false,
        );
      });
      await userEvent.click(screen.getByRole("button", { name: PUBLISH_NAME }));
      const password = await screen.findByLabelText("Contrase\u00f1a");
      expect(writes()).toHaveLength(1);
      const refusedAttempt = writes()[0];
      fireEvent.change(password, {
        target: { value: fakePassword() },
      });
      await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
      await waitFor(() => {
        expect(screen.queryByLabelText("Contrase\u00f1a")).toBeNull();
      });
      const beforeScopeRefresh = await currentRead(reads, "validation-points", context);
      expect(screen.getByRole("button", { name: PUBLISH_NAME }).hasAttribute("disabled")).toBe(
        true,
      );
      if (scopeChange === "still-permitted scope refresh") {
        context = geographyContext(SELECTED) + "|";
        api.setRoute("GET /api/v1/me/", () => Response.json(SELECTED));
      }
      await act(async () => {
        await app.queryClient.refetchQueries({ queryKey: ["me"] });
      });
      const lookup = await currentRead(reads, "record", context);
      expect(api.requests).toContain(lookup.request);
      if (scopeChange === "still-permitted scope refresh") {
        expect(beforeScopeRefresh.request.signal.aborted).toBe(true);
        expect(queryFor(app.queryClient, "record", context)?.state.status).toBe("pending");
        expect(screen.queryByRole("button", { name: PUBLISH_NAME })).toBeNull();
      }
      // Obsolete requests may settle, but only this scope's lookup can restore its editor.
      await act(async () => {
        const aborted = reads.filter((read) => read.request.signal.aborted);
        for (const read of aborted) {
          read.deliver();
          read.consume();
        }
        await Promise.all(aborted.map((read) => read.reply));
      });
      expect(writes()).toHaveLength(1);
      if (scopeChange === "still-permitted scope refresh") {
        expect(queryFor(app.queryClient, "record", context)?.state.status).toBe("pending");
        expect(screen.queryByRole("button", { name: PUBLISH_NAME })).toBeNull();
      }
      await consume(lookup);
      await waitFor(() => {
        expect(lookup.request.signal.aborted).toBe(false);
        expect(queryFor(app.queryClient, "record", context)?.state).toMatchObject({
          status: "success",
          fetchStatus: "idle",
        });
        expect(queryFor(app.queryClient, "record", context)?.meta?.["revision"]).toBe(
          currentRevision(),
        );
        expect(
          screen.getByRole<HTMLTextAreaElement>("textbox", { name: COORDINATES_NAME }).value,
        ).toBe(DRAFT);
        expect(screen.getByRole("button", { name: PUBLISH_NAME }).hasAttribute("disabled")).toBe(
          true,
        );
      });
      const validation = await currentRead(reads, "validation-points", context);
      expect(api.requests).toContain(validation.request);
      await act(async () => {
        validation.deliver();
        await validation.bodyRequested;
      });
      // Even a delivered Response cannot authorize publication before its body is consumed.
      expect(queryFor(app.queryClient, "validation-points", context)?.state.fetchStatus).toBe(
        "fetching",
      );
      const pendingPublish = screen.getByRole("button", { name: PUBLISH_NAME });
      expect(pendingPublish.hasAttribute("disabled")).toBe(true);
      await userEvent.click(pendingPublish);
      expect(writes()).toHaveLength(1);
      await consume(validation);
      await waitFor(() => {
        expect(writes()).toHaveLength(1);
        expect(validation.request.signal.aborted).toBe(false);
        expect(queryFor(app.queryClient, "validation-points", context)?.state).toMatchObject({
          status: "success",
          fetchStatus: "idle",
        });
        expect(queryFor(app.queryClient, "validation-points", context)?.meta?.["revision"]).toBe(
          currentRevision(),
        );
        expect(screen.getByRole("button", { name: PUBLISH_NAME }).hasAttribute("disabled")).toBe(
          false,
        );
        expect(
          screen.getByRole<HTMLTextAreaElement>("textbox", { name: COORDINATES_NAME }).value,
        ).toBe(DRAFT);
      });
      expect(writes()).toHaveLength(1);
      shouldHoldReads = false;
      api.setRoute(
        PUBLISH,
        Response.json({ version: version(2), spacing_warnings: [] }, { status: 201 }),
      );
      await userEvent.click(screen.getByRole("button", { name: PUBLISH_NAME }));
      await screen.findByText("Cambios publicados");
      expect(writes()).toHaveLength(2);
      expect(writes()[0]).toBe(refusedAttempt);
      expect(writes()[1]).not.toBe(refusedAttempt);
      expect(writes()[1]?.body).toEqual(refusedAttempt?.body);
      expect(writes()[1]?.body).toMatchObject({
        expected_revision: 1,
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [5, 0],
              [5, 5],
              [0, 5],
              [0, 0],
            ],
          ],
        },
      });
    },
  );
});
