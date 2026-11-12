import { act, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { apiError } from "../../test/fake-api";
import { ALLOWED, QUADRANT_ID, openGeography, pageOf, quadrant } from "./geography-test-helpers";
vi.mock("./GeographyMap", () => ({ default: () => <div role="region" aria-label="Map" /> }));
function deferred() {
  let release: (reply: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
describe("geography permission and scope isolation", () => {
  test("a deep link without quadrant.read reveals no geography and makes no geography request", async () => {
    const { api } = await openGeography({ me: { ...ALLOWED, permissions: ["quadrant.publish"] } });
    await screen.findByRole("heading", { name: "No tienes acceso a esta secci\u00f3n" });
    expect(api.requests.some(({ path }) => path.startsWith("/api/v1/quadrants/"))).toBe(false);
    expect(screen.queryByRole("link", { name: "Cuadrantes y muestreo" })).toBeNull();
  });
  test.each(["unknown", "foreign", "outside scope"])(
    "%s codes have the same indistinguishable not-found state",
    async (kind) => {
      const me =
        kind === "outside scope"
          ? {
              ...ALLOWED,
              scope: {
                ...ALLOWED.scope,
                quadrants: { mode: "selected" as const, ids: ["another-quadrant"] },
              },
            }
          : ALLOWED;
      await openGeography({
        me,
        routes: {
          "GET /api/v1/quadrants/":
            kind === "foreign"
              ? apiError(404, "not_found")
              : kind === "unknown"
                ? pageOf()
                : pageOf([quadrant()]),
        },
      });
      await screen.findByRole("heading", { name: "No encontramos esta p\u00e1gina" });
      expect(screen.queryByRole("heading", { name: "C-07" })).toBeNull();
      expect(
        screen.queryByRole("textbox", { name: "Forma en el mapa" }),
      ).toBeNull();
    },
  );
  test("changing only active scope clears rows and ignores an earlier pending answer", async () => {
    const late = deferred();
    let reads = 0;
    const { api, app } = await openGeography({
      path: "/quadrants",
      routes: {
        "GET /api/v1/quadrants/": () =>
          ++reads === 2
            ? late.promise
            : pageOf([{ ...quadrant(), code: reads === 1 ? "OLD-PRIVATE" : "NEW-SCOPED" }]),
      },
    });
    await screen.findByRole("link", { name: "OLD-PRIVATE" });
    let refresh: Promise<void> = Promise.resolve();
    act(() => {
      refresh = app.queryClient.refetchQueries({
        predicate: (query) => query.queryKey[3] === "geography",
      });
    });
    await waitFor(() => {
      expect(reads).toBe(2);
    });
    api.setRoute(
      "GET /api/v1/me/",
      Response.json({
        ...ALLOWED,
        scope: { ...ALLOWED.scope, quadrants: { mode: "selected", ids: [QUADRANT_ID] } },
      }),
    );
    await act(async () => {
      await app.queryClient.refetchQueries({ queryKey: ["me"] });
    });
    await screen.findByRole("link", { name: "NEW-SCOPED" });
    expect(screen.queryByText("OLD-PRIVATE")).toBeNull();
    expect(
      app.queryClient
        .getQueryCache()
        .getAll()
        .some(
          (query) =>
            query.state.data !== undefined &&
            JSON.stringify(query.state.data).includes("OLD-PRIVATE"),
        ),
    ).toBe(false);
    await act(async () => {
      late.release(pageOf([{ ...quadrant(), code: "LATE-PRIVATE" }]));
      await refresh;
    });
    expect(screen.queryByText("LATE-PRIVATE")).toBeNull();
    expect(screen.getByRole("link", { name: "NEW-SCOPED" })).toBeDefined();
  });
});
