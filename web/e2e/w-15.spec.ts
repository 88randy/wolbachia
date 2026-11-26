import { expect, test } from "./fixtures/test";
import type { Page } from "@playwright/test";
import type { Schemas } from "@wolbachia/api-client";
import { messages } from "@wolbachia/i18n";
import { makeMe } from "../src/test/fake-api";
import { mockApi } from "./fixtures/mock-api";
import { deferCompactResize, releaseCompactResize } from "./fixtures/compact-resize";
import { interceptSyntheticTiles } from "./fixtures/map-runtime";
import {
  LANGUAGES,
  THEMES,
  rememberPreferences,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
} from "./fixtures/a11y";
const QUADRANT_ID = "00000000-0000-4000-8000-000000000001";
const BLOCK_ID = "00000000-0000-4000-8000-000000000002";
const POINT_ID = "00000000-0000-4000-8000-000000000003";
const CREATED_AT = "2026-10-01T12:00:00Z";
const POLYGON = {
  type: "Polygon" as const,
  coordinates: [
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0],
    ],
  ],
};
const PROPOSAL = {
  quadrant: QUADRANT_ID,
  geometry: {
    type: "Polygon" as const,
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  },
  points: [
    [0.1, 0.1],
    [0.2, 0.1],
    [0.2, 0.2],
    [0.1, 0.2],
  ],
  requires_review: true,
};
const pageOf = (results: unknown[]) => ({
  count: results.length,
  next: null,
  previous: null,
  results,
});
function initialVersion(): Schemas["QuadrantVersion"] {
  return {
    id: "version-1",
    quadrant: QUADRANT_ID,
    area_m2: null,
    perimeter_m: null,
    geometry: POLYGON,
    revision: 1,
    effective_from: CREATED_AT,
    created_at: CREATED_AT,
    created_by: null,
    created_by_name: null,
    point_resolutions: [],
  };
}
/** The block that holds the saved sampling point (3, 3); its quadrant is the one being edited. */
function savedBlock(): Schemas["Block"] {
  const square = {
    type: "Polygon" as const,
    coordinates: [
      [
        [2.5, 2.5],
        [3.5, 2.5],
        [3.5, 3.5],
        [2.5, 3.5],
        [2.5, 2.5],
      ],
    ],
  };
  return {
    id: BLOCK_ID,
    quadrant: QUADRANT_ID,
    code: "B-0001",
    created_at: CREATED_AT,
    created_by: null,
    current_version: {
      id: "block-version-0",
      block: BLOCK_ID,
      geometry: square,
      area_m2: null,
      perimeter_m: null,
      revision: 1,
      effective_from: CREATED_AT,
      created_at: CREATED_AT,
      created_by: null,
    },
  };
}
function samplingPoint(code = "OV-010", id = POINT_ID): Schemas["SamplingPoint"] {
  return {
    id,
    code,
    block: BLOCK_ID,
    created_at: CREATED_AT,
    created_by: null,
    current_version: {
      id: id + "-version",
      point: id,
      location: [3, 3],
      version: 1,
      is_retired: false,
      effective_from: CREATED_AT,
      created_at: CREATED_AT,
      created_by: null,
      created_by_name: null,
    },
  };
}
/** The corner handles sit where the edge-length labels cross: read them from those labels. */
async function dragTopRightCornerInside(page: Page) {
  const labels = page.getByText(/^\d{3}([.,]\d+)? km$/);
  await expect(labels).toHaveCount(4);
  const centers = await labels.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }),
  );
  const left = Math.min(...centers.map((center) => center.x));
  const right = Math.max(...centers.map((center) => center.x));
  const top = Math.min(...centers.map((center) => center.y));
  const bottom = Math.max(...centers.map((center) => center.y));
  await page.mouse.move(right, top);
  await page.mouse.down();
  await page.mouse.move((left + right) / 2, (top + bottom) / 2, { steps: 12 });
  await page.mouse.up();
}

for (const language of LANGUAGES) {
  for (const theme of THEMES) {
    test(`W22-W24 keyboard R2 wiring: ${language}, ${theme}`, async ({ page, baseURL }) => {
      if (!baseURL) throw new Error("The quadrant journey needs the configured baseURL.");
      await deferCompactResize(page);
      await interceptSyntheticTiles(page, new URL(baseURL).origin);
      const copy = messages[language];
      await rememberPreferences(page, theme, language);
      await mockApi(page, {
        me: makeMe({
          permissions: ["quadrant.read", "quadrant.publish", "sampling_point.create"],
          scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
        }),
      });
      let version = initialVersion();
      const points = [samplingPoint()];
      let accepted = false;
      let published = false;
      const submittedCodes: string[] = [];
      await page.route("**/api/v1/quadrants/**", async (route) => {
        const isVersions = new URL(route.request().url()).pathname.endsWith("/versions/");
        if (route.request().method() === "POST") {
          const body = route.request().postDataJSON() as Schemas["QuadrantPublicationRequest"];
          expect(body.expected_revision).toBe(1);
          expect(body.point_resolutions).toEqual([
            { point: POINT_ID, decision: "keep", evidence: "Outside point explicitly approved" },
          ]);
          version = { ...version, id: "version-2", revision: 2, geometry: body.geometry };
          published = true;
          await route.fulfill({ status: 201, json: { version, spacing_warnings: [] } });
          return;
        }
        await route.fulfill({
          json: isVersions
            ? pageOf([version])
            : pageOf([
                {
                  id: QUADRANT_ID,
                  code: "C-07",
                  center: "center-north",
                  current_version: version,
                  created_at: CREATED_AT,
                  created_by: null,
                },
              ]),
        });
      });
      await page.route("**/api/v1/blocks/**", async (route) => {
        if (new URL(route.request().url()).pathname.endsWith("/suggestion/")) {
          await route.fulfill({ json: accepted ? [] : [PROPOSAL] });
          return;
        }
        if (route.request().method() === "POST") {
          const body = route.request().postDataJSON() as Schemas["BlockCreateRequest"];
          expect(body).toEqual({
            quadrant: QUADRANT_ID,
            code: "B-0131",
            geometry: PROPOSAL.geometry,
          });
          accepted = true;
          await route.fulfill({
            status: 201,
            json: {
              id: BLOCK_ID,
              ...body,
              current_version: {
                id: "block-version",
                block: BLOCK_ID,
                geometry: body.geometry,
                revision: 1,
                effective_from: CREATED_AT,
                created_at: CREATED_AT,
                created_by: null,
              },
              created_at: CREATED_AT,
              created_by: null,
            },
          });
          return;
        }
        await route.fulfill({ json: pageOf([savedBlock()]) });
      });
      await page.route("**/api/v1/sampling-points/**", async (route) => {
        if (route.request().method() === "POST") {
          const body = route.request().postDataJSON() as Schemas["SamplingPointCreateRequest"];
          expect(body.block).toBe(BLOCK_ID);
          submittedCodes.push(body.code);
          const point = samplingPoint(body.code, body.code);
          points.push(point);
          await route.fulfill({
            status: 201,
            json: {
              point,
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
          });
          return;
        }
        await route.fulfill({ json: pageOf(points) });
      });
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/quadrants");
      const code = page.getByRole("link", { name: "C-07" });
      await code.focus();
      await page.keyboard.press("Enter");
      const map = page.getByRole("region", { name: copy["mapEditor.map.label"], exact: true });
      await expect(map).toBeVisible();
      const sidebarToggle = page.getByRole("button", { name: copy["shell.sidebar.collapse"] });
      for (const viewport of [
        { width: 1280, height: 800 },
        { width: 1440, height: 900 },
        { width: 320, height: 800 },
      ]) {
        await page.setViewportSize(viewport);
        await expectNoHorizontalScroll(page);
      }
      await expect(sidebarToggle).toBeVisible();
      await releaseCompactResize(page);
      await expect(sidebarToggle).toHaveCount(0);
      // Real layout checks belong to this browser journey, not jsdom.
      await page.evaluate(() => {
        document.body.style.fontSize = "130%";
      });
      await expectNoHorizontalScroll(page);
      // The quadrant is reshaped on the map: drag its top-right corner inside, so the sampling
      // point ends up outside and needs a decision and a reason before anything can be saved.
      const save = page.getByRole("button", { name: copy["mapEditor.action.saveChanges"] });
      await expect(
        page.getByRole("region", { name: copy["mapEditor.pending.title"], exact: true }),
      ).toContainText(copy["mapEditor.pending.empty"]);
      await page.evaluate(() => {
        document.body.style.fontSize = "";
      });
      await page.setViewportSize({ width: 1280, height: 1000 });
      await map.scrollIntoViewIfNeeded();
      await dragTopRightCornerInside(page);
      const pending = page.getByRole("region", { name: copy["mapEditor.pending.title"] });
      await expect(pending).toContainText("C-07");
      await expect(save).toBeDisabled();
      await page
        .getByRole("combobox", {
          name: copy["mapEditor.move.decision"].replace("{point}", "OV-010"),
        })
        .click();
      await page.getByRole("option", { name: copy["mapEditor.move.keep"], exact: true }).click();
      await page
        .getByRole("textbox", { name: copy["mapEditor.move.reason"] })
        .fill("Outside point explicitly approved");
      await expect(save).toBeEnabled();
      await save.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByText(copy["mapEditor.saved.all"].replace("{count}", "1"), { exact: true }),
      ).toBeVisible();
      expect(published).toBe(true);
      await page.getByRole("button", { name: copy["geography.blocks.suggest"] }).click();
      await page.getByRole("textbox", { name: copy["geography.blocks.code"] }).fill("B-0131");
      await page.getByRole("button", { name: copy["geography.blocks.accept"] }).click();
      const codes = page.getByRole("textbox", { name: copy["geography.points.code"] });
      await expect(codes).toHaveCount(4);
      for (let index = 0; index < 4; index += 1)
        await codes.nth(index).fill("OV-" + String(100 + index));
      await page.getByRole("button", { name: copy["geography.points.four"] }).click();
      await expect(
        page.getByRole("complementary", { name: copy["geography.points.spacing"] }),
      ).toContainText("OV-010");
      expect(submittedCodes).toEqual(["OV-100", "OV-101", "OV-102", "OV-103"]);
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
    });
  }
}
