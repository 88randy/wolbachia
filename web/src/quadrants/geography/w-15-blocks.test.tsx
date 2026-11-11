import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { Schemas } from "@wolbachia/api-client";
import type { FakeApiRoutes } from "../../test/fake-api";
import { fakePassword } from "../../test/fake-credentials";
import { apiError } from "../../test/fake-api";
import {
  ALLOWED,
  BLOCK_ID,
  CREATED_AT,
  POLYGON,
  POINT_ID,
  QUADRANT_ID,
  openGeography,
  point,
  pageOf,
} from "./geography-test-helpers";

vi.mock("./GeographyMap", () => ({ default: () => <div role="region" aria-label="Map" /> }));
const BLOCK: Schemas["Block"] = {
  id: BLOCK_ID,
  code: "B-0131",
  quadrant: QUADRANT_ID,
  created_at: CREATED_AT,
  created_by: null,
  current_version: {
    id: "block-version",
    block: BLOCK_ID,
    area_m2: null,
    perimeter_m: null,
    geometry: POLYGON,
    revision: 1,
    effective_from: CREATED_AT,
    created_at: CREATED_AT,
    created_by: null,
    created_by_name: null,
  },
};
function createdPoint(code: string): Schemas["SamplingPoint"] {
  const original = point();
  return {
    ...original,
    id: code,
    code,
    current_version: original.current_version ? { ...original.current_version, point: code } : null,
  };
}
describe("W24 proposals and partial point creation", () => {
  test("reviews a proposal before creating its block and retains fixed codes after a partial point failure", async () => {
    let pointAttempts = 0;
    const { api } = await openGeography({
      routes: {
        "POST /api/v1/blocks/": () => {
          api.setRoute("GET /api/v1/blocks/suggestion/", Response.json([]));
          return Response.json(BLOCK, { status: 201 });
        },
        "POST /api/v1/sampling-points/": (request) => {
          pointAttempts += 1;
          if (pointAttempts === 2)
            return apiError(400, "validation_error", {
              fields: { location: [{ code: "invalid_location" }] },
            });
          const body = request.body as Schemas["SamplingPointCreateRequest"];
          return Response.json(
            {
              point: createdPoint(body.code),
              spacing_warnings:
                body.code === "OV-103"
                  ? [
                      {
                        code: "spacing_below_minimum",
                        point: POINT_ID,
                        distance_m: 32,
                        minimum_m: 50,
                      },
                    ]
                  : [],
            },
            { status: 201 },
          );
        },
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Solicitar sugerencias" }));
    const accept = await screen.findByRole("button", { name: "Aceptar propuesta de manzana" });
    expect(api.requests.some(({ method }) => method === "POST")).toBe(false);
    fireEvent.change(screen.getByRole("textbox", { name: "C\u00f3digo fijo de manzana" }), {
      target: { value: BLOCK.code },
    });
    await userEvent.click(accept);
    const pointCodes = await screen.findAllByRole<HTMLInputElement>("textbox", {
      name: "C\u00f3digo fijo del punto",
    });
    for (const [index, input] of pointCodes.entries())
      fireEvent.change(input, { target: { value: "OV-" + String(100 + index) } });
    const create = screen.getByRole("button", { name: "Crear cuatro puntos" });
    await userEvent.click(create);
    const batchForm = create.closest("form");
    if (!batchForm) throw new Error("Missing four-point form");
    await within(batchForm).findByRole("alert");
    expect(
      pointCodes[0]?.hasAttribute("disabled") ||
        pointCodes[0]?.closest("fieldset")?.hasAttribute("disabled"),
    ).toBe(true);
    await waitFor(() => {
      expect(create.hasAttribute("disabled")).toBe(false);
    });
    await userEvent.click(create);
    await waitFor(() => {
      expect(
        api.requests.filter(
          ({ method, path }) => method === "POST" && path === "/api/v1/sampling-points/",
        ),
      ).toHaveLength(5);
    });
    await screen.findByRole("complementary", {
      name: "Advertencia de separaci\u00f3n (no bloquea)",
    });
    await waitFor(() => {
      expect(
        api.requests.filter(
          ({ method, path }) => method === "POST" && path === "/api/v1/sampling-points/",
        ),
      ).toHaveLength(5);
    });
    const bodies = api.requests
      .filter(({ method, path }) => method === "POST" && path === "/api/v1/sampling-points/")
      .map(({ body }) => body as Schemas["SamplingPointCreateRequest"]);
    expect(bodies.map(({ code }) => code)).toEqual([
      "OV-100",
      "OV-101",
      "OV-101",
      "OV-102",
      "OV-103",
    ]);
    expect(bodies.every(({ block }) => block === BLOCK_ID)).toBe(true);
    const warning = within(
      screen.getByRole("complementary", { name: "Advertencia de separaci\u00f3n (no bloquea)" }),
    );
    expect(warning.getByText(/OV-010/).textContent).toContain("32");
    expect(warning.getByText(/OV-010/).textContent).toContain("50");
    expect(create.hasAttribute("disabled")).toBe(true);
  });
});

function deferredReply() {
  let resolve!: (response: Response) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Response>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}
async function prepareBatch(routes: FakeApiRoutes) {
  const { api, app } = await openGeography({
    language: "en",
    routes: { "POST /api/v1/blocks/": Response.json(BLOCK, { status: 201 }), ...routes },
  });
  await userEvent.click(await screen.findByRole("button", { name: "Request suggestions" }));
  const accept = await screen.findByRole("button", { name: "Accept block proposal" });
  fireEvent.change(screen.getByRole("textbox", { name: "Fixed block code" }), {
    target: { value: BLOCK.code },
  });
  await userEvent.click(accept);
  const codes = await screen.findAllByRole<HTMLInputElement>("textbox", {
    name: "Fixed point code",
  });
  for (const [index, input] of codes.entries())
    fireEvent.change(input, { target: { value: "OV-" + String(100 + index) } });
  return { api, app, codes, create: screen.getByRole("button", { name: "Create four points" }) };
}
function persistedPoint(body: Schemas["SamplingPointCreateRequest"]): Schemas["SamplingPoint"] {
  const saved = createdPoint(body.code);
  if (!saved.current_version) throw new Error("Missing point version");
  return {
    ...saved,
    block: body.block,
    current_version: { ...saved.current_version, location: body.location },
  };
}
test.each(["lost", "gateway", "empty", "duplicate"])(
  "an ambiguous committed outcome %s must reconcile explicitly before the other three points",
  async (outcome) => {
    const lost = deferredReply();
    const lookup = deferredReply();
    const persisted = new Map<string, Schemas["SamplingPoint"]>();
    const { api, codes, create } = await prepareBatch({
      "POST /api/v1/sampling-points/": (request) => {
        const body = request.body as Schemas["SamplingPointCreateRequest"];
        if (persisted.has(body.code))
          return apiError(400, "validation_error", {
            fields: { code: [{ code: "duplicate_code" }] },
          });
        const saved = persistedPoint(body);
        persisted.set(body.code, saved);
        return persisted.size === 1
          ? lost.promise
          : Response.json({ point: saved, spacing_warnings: [] }, { status: 201 });
      },
      "GET /api/v1/sampling-points/": (request) =>
        new URL(request.path, "https://test.invalid").searchParams.has("code")
          ? lookup.promise
          : pageOf([...persisted.values()]),
    });
    await userEvent.click(create);
    await waitFor(() => {
      expect(persisted.size).toBe(1);
    });
    await act(async () => {
      releaseCreationReply(lost, outcome);
      await Promise.resolve();
    });
    const reconcile = await screen.findByRole("button", { name: "Reconcile point creation" });
    expect(create.hasAttribute("disabled")).toBe(true);
    expect(codes[0]?.matches(":disabled")).toBe(true);
    expect(api.requests.some(({ path }) => path.includes("code=OV-100"))).toBe(false);
    await userEvent.click(reconcile);
    await waitFor(() => {
      expect(api.requests.some(({ path }) => path.includes("code=OV-100"))).toBe(true);
    });
    await userEvent.click(create);
    expect(persisted.size).toBe(1);
    await act(async () => {
      lookup.resolve(pageOf([...persisted.values()]));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(create.hasAttribute("disabled")).toBe(false);
    });
    expect(persisted.size).toBe(1);
    expect(codes[0]?.matches(":disabled")).toBe(true);
    await userEvent.click(create);
    await waitFor(() => {
      expect(persisted.size).toBe(4);
    });
    await waitFor(() => {
      expect(create.hasAttribute("disabled")).toBe(true);
    });
    expect([...persisted.keys()]).toEqual(["OV-100", "OV-101", "OV-102", "OV-103"]);
    expect(
      api.requests.filter(
        ({ method, path }) => method === "POST" && path === "/api/v1/sampling-points/",
      ),
    ).toHaveLength(4);
  },
);
test.each(["block", "location", "missing"])(
  "an uncertain point remains frozen when the scoped lookup has a mismatched %s",
  async (mismatch) => {
    const lost = deferredReply();
    let saved: Schemas["SamplingPoint"] | undefined;
    const { api, codes, create } = await prepareBatch({
      "POST /api/v1/sampling-points/": (request) => {
        saved = persistedPoint(request.body as Schemas["SamplingPointCreateRequest"]);
        return lost.promise;
      },
      "GET /api/v1/sampling-points/": (request) => {
        if (!new URL(request.path, "https://test.invalid").searchParams.has("code"))
          return pageOf();
        if (!saved?.current_version || mismatch === "missing") return pageOf();
        return pageOf([
          {
            ...saved,
            block: mismatch === "block" ? "another-block" : saved.block,
            current_version: {
              ...saved.current_version,
              location: mismatch === "location" ? [9, 9] : saved.current_version.location,
            },
          },
        ]);
      },
    });
    await userEvent.click(create);
    await waitFor(() => {
      expect(saved).toBeDefined();
    });
    await act(async () => {
      lost.reject(new TypeError("Response lost after commit"));
      await Promise.resolve();
    });
    await userEvent.click(await screen.findByRole("button", { name: "Reconcile point creation" }));
    await screen.findByText(
      "The scoped result does not confirm this block and location. Keep the code locked and ask a supervisor to verify.",
    );
    expect(create.hasAttribute("disabled")).toBe(true);
    expect(codes[0]?.matches(":disabled")).toBe(true);
    expect(
      api.requests.filter(
        ({ method, path }) => method === "POST" && path === "/api/v1/sampling-points/",
      ),
    ).toHaveLength(1);
  },
);

test("a deferred reconciliation 401 releases the same-identity form for another manual read without replay", async () => {
  const lost = deferredReply();
  const lookup = deferredReply();
  let saved: Schemas["SamplingPoint"] | undefined;
  const { api, app, create } = await prepareBatch({
    "POST /api/v1/sampling-points/": (request) => {
      saved = persistedPoint(request.body as Schemas["SamplingPointCreateRequest"]);
      return lost.promise;
    },
    "GET /api/v1/sampling-points/": (request) =>
      new URL(request.path, "https://test.invalid").searchParams.has("code")
        ? lookup.promise
        : pageOf(),
    "POST /api/v1/auth/login/": Response.json({
      me: ALLOWED,
      server_time: "2026-11-04T12:00:00Z",
    }),
  });
  document.cookie = "csrftoken=test-csrf; path=/";
  await userEvent.click(create);
  await waitFor(() => {
    expect(saved).toBeDefined();
  });
  await act(async () => {
    lost.reject(new TypeError("Response lost after commit"));
    await Promise.resolve();
  });
  await userEvent.click(await screen.findByRole("button", { name: "Reconcile point creation" }));
  await waitFor(() => {
    expect(api.requests.some(({ path }) => path.includes("code=OV-100"))).toBe(true);
  });
  await act(async () => {
    lookup.resolve(apiError(401, "not_authenticated"));
    await Promise.resolve();
  });
  const password = await screen.findByLabelText("Password");
  api.setRoute("GET /api/v1/sampling-points/", (request) =>
    new URL(request.path, "https://test.invalid").searchParams.has("code") && saved
      ? pageOf([saved])
      : pageOf(),
  );
  fireEvent.change(password, { target: { value: fakePassword() } });
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() => {
    expect(screen.queryByLabelText("Password")).toBeNull();
  });
  await act(async () => {
    await app.queryClient.refetchQueries({ queryKey: ["me"] });
  });
  const reconcile = screen.getByRole("button", { name: "Reconcile point creation" });
  await waitFor(() => {
    expect(reconcile.hasAttribute("disabled")).toBe(false);
  });
  expect(create.hasAttribute("disabled")).toBe(true);
  await userEvent.click(reconcile);
  await waitFor(() => {
    expect(create.hasAttribute("disabled")).toBe(false);
  });
  expect(
    api.requests.filter(
      ({ method, path }) => method === "POST" && path === "/api/v1/sampling-points/",
    ),
  ).toHaveLength(1);
});

function releaseCreationReply(reply: ReturnType<typeof deferredReply>, outcome: string) {
  if (outcome === "lost") {
    reply.reject(new TypeError("Response lost after commit"));
    return;
  }
  if (outcome === "gateway") {
    reply.resolve(apiError(502, "server_error"));
    return;
  }
  if (outcome === "empty") {
    reply.resolve(new Response(null, { status: 201 }));
    return;
  }
  reply.resolve(
    apiError(400, "validation_error", { fields: { code: [{ code: "duplicate_code" }] } }),
  );
}

test.each([0, 1])(
  "a definitive point POST 401 after %i saved points permits only a manual pending retry after reauthentication",
  async (savedBeforeRejection) => {
    const rejection = deferredReply();
    const persisted = new Map<string, Schemas["SamplingPoint"]>();
    let attempts = 0;
    const { api, app, codes, create } = await prepareBatch({
      "POST /api/v1/sampling-points/": (request) => {
        attempts += 1;
        if (attempts === savedBeforeRejection + 1) return rejection.promise;
        const body = request.body as Schemas["SamplingPointCreateRequest"];
        const saved = persistedPoint(body);
        persisted.set(body.code, saved);
        return Response.json({ point: saved, spacing_warnings: [] }, { status: 201 });
      },
      "GET /api/v1/sampling-points/": (request) =>
        new URL(request.path, "https://test.invalid").searchParams.has("code")
          ? pageOf()
          : pageOf([...persisted.values()]),
      "POST /api/v1/auth/login/": Response.json({
        me: ALLOWED,
        server_time: "2026-11-04T12:00:00Z",
      }),
    });
    document.cookie = "csrftoken=test-csrf; path=/";
    await userEvent.click(create);
    await waitFor(() => {
      expect(attempts).toBe(savedBeforeRejection + 1);
    });
    expect(persisted.size).toBe(savedBeforeRejection);
    await act(async () => {
      rejection.resolve(apiError(401, "not_authenticated"));
      await Promise.resolve();
    });
    fireEvent.change(await screen.findByLabelText("Password"), {
      target: { value: fakePassword() },
    });
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(screen.queryByLabelText("Password")).toBeNull();
    });
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    expect(screen.queryByRole("button", { name: "Reconcile point creation" })).toBeNull();
    await waitFor(() => {
      expect(create.hasAttribute("disabled")).toBe(false);
    });
    expect(codes[savedBeforeRejection]?.matches(":disabled")).toBe(false);
    expect(attempts).toBe(savedBeforeRejection + 1);
    expect(persisted.size).toBe(savedBeforeRejection);
    await userEvent.click(create);
    await waitFor(() => {
      expect(persisted.size).toBe(4);
    });
    await waitFor(() => {
      expect(create.hasAttribute("disabled")).toBe(true);
    });
    const sentCodes = api.requests
      .filter(({ method, path }) => method === "POST" && path === "/api/v1/sampling-points/")
      .map(({ body }) => (body as Schemas["SamplingPointCreateRequest"]).code);
    const fixedCodes = ["OV-100", "OV-101", "OV-102", "OV-103"];
    expect(sentCodes).toEqual([
      ...fixedCodes.slice(0, savedBeforeRejection + 1),
      ...fixedCodes.slice(savedBeforeRejection),
    ]);
    expect([...persisted.keys()]).toEqual(fixedCodes);
  },
);
