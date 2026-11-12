import { screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { createFakeApi, makeMe } from "../../test/fake-api";
import { renderApp } from "../../test/render-app";

const RELEASE_ID = "00000000-0000-4000-8000-000000000046";
const ME = makeMe({ permissions: ["release.read"] });

function releaseJson() {
  return {
    id: RELEASE_ID,
    code: "LIB-0042",
    permit_code: "P-014",
    quadrant_code: "Q-08",
    lot_code: "L-77",
    release_device_code: "RD-5",
    quantity: "12",
    location: [],
    device_time: "2026-11-03T14:12:00Z",
    server_received_at: "2026-11-03T14:13:00Z",
    blocked_by: [],
  };
}

function open(path: string, found: boolean) {
  const api = createFakeApi({
    "GET /api/v1/me/": () => Response.json(ME),
    "GET /api/v1/releases/": () =>
      Response.json({
        count: found ? 1 : 0,
        next: null,
        previous: null,
        results: found ? [releaseJson()] : [],
      }),
    ["GET /api/v1/releases/" + RELEASE_ID + "/"]: () => Response.json(releaseJson()),
  });
  return renderApp({ path, fetch: api.fetch });
}

test("a release opens by its human code through a scoped lookup", async () => {
  await open("/releases/records/LIB-0042", true);
  expect(await screen.findByText("P-014")).toBeDefined();
  expect(screen.getAllByText("LIB-0042").length).toBeGreaterThan(0);
});

test("a code the scope does not know shows the not found page", async () => {
  await open("/releases/records/LIB-0042", false);
  expect(await screen.findByText("No encontramos esta página")).toBeDefined();
});

test("an old link with the id still opens the release", async () => {
  await open("/releases/records/" + RELEASE_ID, true);
  expect((await screen.findAllByText("LIB-0042")).length).toBeGreaterThan(0);
});
