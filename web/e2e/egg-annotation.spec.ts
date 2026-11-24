import type { Page } from "@playwright/test";
import type { MessageKey } from "@wolbachia/i18n";
import { messages } from "@wolbachia/i18n";
import type { Schemas } from "@wolbachia/api-client";
import { expect, test } from "./fixtures/test";
import {
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  rememberPreferences,
} from "./fixtures/a11y";
import { mockApi } from "./fixtures/mock-api";
import { makeMe } from "../src/test/fake-api";

const UPLOAD_ID = "40000000-0000-4000-8000-000000000001";
const ANNOTATION_ID = "40000000-0000-4000-8000-000000000002";
const IMAGE_WIDTH = 4096;
const IMAGE_HEIGHT = 1024;
const BAG_CODE = "B-031";
const BAG_ID = "40000000-0000-4000-8000-000000000003";
const COUNTER = "output[aria-live='polite']";
const DRAFT_DATABASE = "aedesvision-egg-drafts";
const DRAFT_STORE = "drafts";
const DRAFT_KEY =
  "aedesvision:annotation:" +
  JSON.stringify(["5f5c4c3e-4a0e-4a64-9a60-1a2b3c4d5e6f", "norte", BAG_CODE, "new"]);
const COMPACT_VIEWPORT = { width: 320, height: 800 };
const VIEWPORTS = [COMPACT_VIEWPORT, { width: 1280, height: 900 }];

function pageOf(results: readonly unknown[]) {
  return { count: results.length, next: null, previous: null, results };
}

test("W35 recovers 1,000 authored marks explicitly and keeps editing responsive", async ({
  page,
}, testInfo) => {
  const text = (key: MessageKey) => messages["es-MX"][key];
  await mockAnnotation(page);
  await page.goto("/lab/egg-counts");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(
    async ({ databaseName, storeName, key, width, height }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((photo) => {
          if (photo) resolve(photo);
          else reject(new Error("Unable to make synthetic photo"));
        }, "image/png");
      });
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onsuccess = () => {
          resolve(request.result);
        };
        request.onerror = () => {
          reject(request.error ?? new Error("Unable to open draft database"));
        };
      });
      const draft = {
        version: 1,
        file: new File([blob], "synthetic-paddle.png", { type: "image/png" }),
        clientId: crypto.randomUUID(),
        marks: Array.from({ length: 1000 }, (_, index) => ({
          kind: "point",
          x: (index % 100) * 40 + 10,
          y: Math.floor(index / 100) * 80 + 10,
        })),
      };
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        transaction.objectStore(storeName).put(draft, key);
        transaction.oncomplete = () => {
          resolve();
        };
        transaction.onerror = () => {
          reject(transaction.error ?? new Error("Unable to store draft"));
        };
      });
      database.close();
    },
    {
      databaseName: DRAFT_DATABASE,
      storeName: DRAFT_STORE,
      key: DRAFT_KEY,
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
    },
  );
  await page.goto(`/lab/egg-counts/${BAG_CODE}/annotate`);
  const recovery = page.getByRole("dialog", { name: text("labAnnotation.recover.title") });
  await expect(recovery).toBeVisible();
  await expect(page.locator(COUNTER)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/lab\/egg-counts(?:\?|$)/);
  await page.goto(`/lab/egg-counts/${BAG_CODE}/annotate`);
  await expect(recovery).toBeVisible();
  await recovery.getByRole("button", { name: text("labAnnotation.recover.accept") }).click();
  await page.getByRole("button", { name: text("labAnnotation.tips.close") }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const canvas = page
    .getByRole("application", { name: text("labAnnotation.canvas.label") })
    .locator("canvas[tabindex='0']");
  await expect(page.locator(COUNTER)).toContainText("1000");
  await canvas.focus();
  await expect(canvas).toBeFocused();
  await page.keyboard.press("+");
  await page.keyboard.press("h");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("d");
  await page.keyboard.press("Enter");
  await expect(page.locator(COUNTER)).toContainText("1001");
  await page.keyboard.press("Control+z");
  await expect(page.locator(COUNTER)).toContainText("1000");
  await page.screenshot({ path: testInfo.outputPath("W35-1000-marks.png"), fullPage: true });
  await expectNoAxeViolations(page);
});

function candidate(code: string): Schemas["LabQueueCandidate"] {
  return {
    id: BAG_ID,
    code,
    reading_id: "40000000-0000-4000-8000-000000000004",
    expected_revision: 0,
    has_eggs: true,
    is_lagged: false,
    is_index_excluded: false,
  };
}

function counted(value: number): Schemas["LabCount"] {
  return {
    id: "40000000-0000-4000-8000-000000000005",
    bag_id: BAG_ID,
    bag_code: BAG_CODE,
    value,
    annotation_id: ANNOTATION_ID,
    ordinal: 1,
    viable_eggs: null,
    total_examined: null,
    viability_percent: null,
    viability_reason: "not_requested",
    method_version: null,
    method: null,
    verification_id: null,
    rules: {},
    source_proof: {},
    created_at: "2026-11-24T18:00:00Z",
    created_by: "40000000-0000-4000-8000-000000000006",
    voided: false,
    expected_revision: 1,
    current_revision: 1,
    is_current: true,
  };
}

test("W35 history opens an authorized annotation with view-only tools", async ({ page }) => {
  const text = (key: MessageKey) => messages["es-MX"][key];
  const commands: unknown[] = [];
  await mockApi(page, {
    me: makeMe({
      permissions: ["egg_count.read"],
      scope: {
        centers: { mode: "all", ids: [] },
        quadrants: { mode: "all", ids: [] },
      },
    }),
  });
  await page.route("**/api/v1/egg-counts/**", (route) =>
    route.fulfill({ json: pageOf([counted(2)]) }),
  );
  await page.route("**/api/v1/egg-counts/*/annotation/", (route) =>
    route.fulfill({
      json: {
        id: ANNOTATION_ID,
        public_id: ANNOTATION_ID,
        count: counted(2).id,
        bag: BAG_ID,
        bag_code: BAG_CODE,
        upload_id: UPLOAD_ID,
        image_url: `/api/v1/attachments/${UPLOAD_ID}/download/`,
        image_width: IMAGE_WIDTH,
        image_height: IMAGE_HEIGHT,
        marks: [
          { kind: "box", x: 10, y: 20, w: 12, h: 24 },
          { kind: "point", x: 50, y: 60 },
        ],
        box_count: 1,
        point_count: 1,
        tool_version: "aedesvision-web-1",
        elapsed_seconds: null,
        created_by: "40000000-0000-4000-8000-000000000006",
        created_at: "2026-11-24T18:00:00Z",
      } satisfies Schemas["EggAnnotation"],
    }),
  );
  await page.route("**/api/v1/bags/*/counts/", (route) => {
    commands.push(route.request().postDataJSON());
    return route.fulfill({ status: 403, json: { code: "permission_denied", params: {} } });
  });
  await page.goto("/lab/count-history");
  const photo = await syntheticPhoto(page);
  await page.route(`**/api/v1/attachments/${UPLOAD_ID}/download/`, (route) =>
    route.fulfill({
      contentType: "image/png",
      body: photo.buffer,
    }),
  );
  await page
    .getByRole("button", { name: text("labAnnotation.editor.viewer"), exact: true })
    .click();
  const viewer = page.getByRole("dialog", { name: text("labAnnotation.editor.viewer") });
  await expect(
    viewer.getByText(text("labAnnotation.editor.readOnly"), { exact: true }),
  ).toBeVisible();
  const canvas = viewer.getByRole("application").locator("canvas[tabindex='0']");
  await expect(canvas).toBeVisible();
  await expect(viewer.getByText(text("labAnnotation.canvas.loading"), { exact: true })).toHaveCount(
    0,
  );
  const zoom = await viewer.locator("output").textContent();
  await canvas.focus();
  await page.keyboard.press("+");
  await expect(viewer.locator("output")).not.toHaveText(zoom ?? "");
  await page.keyboard.press("d");
  await page.keyboard.press("Enter");
  await expect(
    viewer.getByRole("button", { name: text("labAnnotation.editor.point"), exact: true }),
  ).toHaveCount(0);
  await expect(
    viewer.getByRole("button", { name: text("labAnnotation.editor.finish"), exact: true }),
  ).toHaveCount(0);
  expect(commands).toEqual([]);
  await expectNoAxeViolations(page);
});

async function mockAnnotation(page: Page) {
  const commands: Schemas["CountWriteRequest"][] = [];
  await mockApi(page, {
    me: makeMe({
      permissions: ["egg_count.create", "egg_count.read", "field.upload"],
      scope: { centers: { mode: "all", ids: [] }, quadrants: { mode: "all", ids: [] } },
    }),
  });
  await page.route("**/api/v1/egg-counts/queue/**", (route) =>
    route.fulfill({ json: pageOf([candidate(BAG_CODE)]) }),
  );
  await page.route("**/api/v1/field/uploads/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/content/")) return route.fulfill({ status: 204 });
    if (path.endsWith("/finalize/"))
      return route.fulfill({
        json: {
          id: UPLOAD_ID,
          state: "verified",
          verified_at: "2026-11-24T18:00:00Z",
          image_width: IMAGE_WIDTH,
          image_height: IMAGE_HEIGHT,
        },
      });
    return route.fulfill({
      status: 201,
      json: {
        upload_id: UPLOAD_ID,
        url: `/api/v1/field/uploads/${UPLOAD_ID}/content/`,
        method: "PUT",
        headers: { "Upload-Lease": "synthetic-annotation-lease", "Content-Type": "image/png" },
        expires_at: "2026-11-24T18:15:00Z",
      },
    });
  });
  await page.route("**/api/v1/bags/*/counts/", (route) => {
    const body = route.request().postDataJSON() as Schemas["CountWriteRequest"];
    commands.push(body);
    return route.fulfill({
      status: 201,
      json: {
        count: counted(body.annotation?.marks.length ?? 0),
        next_bag: candidate("B-032"),
        queue_snapshot: {
          as_of: "2026-11-24T18:00:00Z",
          context: {},
        },
      },
    });
  });
  return commands;
}

async function syntheticPhoto(page: Page) {
  const source = await page.evaluate(
    ({ width, height }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      context.fillStyle = "white";
      context.fillRect(0, 0, width, height);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { width: IMAGE_WIDTH, height: IMAGE_HEIGHT },
  );
  return {
    name: "synthetic-paddle.png",
    mimeType: "image/png",
    buffer: Buffer.from(source ?? "", "base64"),
  };
}

async function expectUncoveredCanvas(canvas: ReturnType<Page["locator"]>) {
  await canvas.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      canvas.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return (
          document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2) ===
          element
        );
      }),
    )
    .toBe(true);
}

for (const theme of ["light", "dark"] as const) {
  for (const language of ["es-MX", "en"] as const) {
    test(`W35 photo annotation keyboard and reflow: ${theme}, ${language}`, async ({
      page,
    }, testInfo) => {
      const text = (key: MessageKey) => messages[language][key];
      await rememberPreferences(page, theme, language);
      const commands = await mockAnnotation(page);
      await page.setViewportSize(COMPACT_VIEWPORT);
      await page.goto(`/lab/egg-counts/${BAG_CODE}/annotate`);
      const picker = page.getByLabel(text("labAnnotation.upload.picker"), { exact: true });
      await expect(picker).toHaveAttribute("accept", "image/*");
      await expect(picker).toHaveAttribute("capture", "environment");
      await picker.setInputFiles(await syntheticPhoto(page));
      await page
        .getByRole("button", { name: text("labAnnotation.upload.start"), exact: true })
        .click();
      await page
        .getByRole("button", { name: text("labAnnotation.tips.close"), exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const canvas = page
        .getByRole("application", { name: text("labAnnotation.canvas.label") })
        .locator("canvas[tabindex='0']");
      await expect(canvas).toBeVisible();
      await expect(
        page.getByText(text("labAnnotation.canvas.loading"), { exact: true }),
      ).toHaveCount(0);
      await canvas.focus();
      await expect(canvas).toBeFocused();
      await page.keyboard.press("b");
      await page.keyboard.press("Enter");
      await expect(page.locator(COUNTER)).toContainText("1");
      await page.keyboard.press("d");
      await expect(
        page.getByRole("button", { name: text("labAnnotation.editor.point"), exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await page.keyboard.press("Enter");
      await expect(page.locator(COUNTER)).toContainText("2");
      await page.keyboard.press("Control+z");
      await expect(page.locator(COUNTER)).toContainText("1");
      await page.keyboard.press("Control+Shift+z");
      await expect(page.locator(COUNTER)).toContainText("2");
      await page.keyboard.press("g");
      await page.keyboard.press("s");
      await expect(page.getByLabel(text("labAnnotation.editor.defaultWidth"))).toBeVisible();
      await expect(
        page.getByRole("checkbox", { name: text("labAnnotation.editor.grid"), exact: true }),
      ).toBeChecked();
      await page.evaluate(() => {
        const root = document.documentElement;
        const computed = getComputedStyle(root);
        for (const name of Array.from(computed).filter(
          (property) => property.startsWith("--web-type-") && property.endsWith("-font-size"),
        ))
          root.style.setProperty(
            name,
            String(Number.parseFloat(computed.getPropertyValue(name)) * 1.3) + "px",
          );
      });
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        await expectNoHorizontalScroll(page);
        await expectUncoveredCanvas(canvas);
        await expectNoAxeViolations(page);
        await page.screenshot({
          path: testInfo.outputPath(`W35-annotation-${String(viewport.width)}.png`),
          fullPage: true,
        });
      }
      await page
        .getByRole("button", { name: text("labAnnotation.editor.finish"), exact: true })
        .click();
      const summary = page.getByRole("dialog");
      await expect(summary).toBeVisible();
      await expectNoAxeViolations(page);
      await summary
        .getByRole("button", { name: text("labAnnotation.summary.save"), exact: true })
        .click();
      await expect.poll(() => commands.length).toBe(1);
      expect(commands[0]?.value).toBe(2);
      expect(commands[0]?.annotation?.marks.map((mark) => mark.kind)).toEqual(["box", "point"]);
      await expect(page).toHaveURL(/\/lab\/egg-counts(?:\?|$)/);
    });
  }
}
